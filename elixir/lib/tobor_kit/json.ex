defmodule ToborKit.Json do
  @moduledoc """
  Deterministic JSON serialization — the reference-backend twin of
  `ToborKit.Compiler.Json`.

  The bundle hash covers **compact JSON with lexicographically sorted keys**
  over the bundle body minus the `bundle_hash` member itself. Object keys are
  sorted as binaries (Elixir's default term order on strings), members have no
  whitespace, strings are Jason-encoded. Both the compiler and this module must
  produce byte-identical output for a given decoded bundle; a divergence here
  silently rejects every legitimate bundle.
  """

  @doc "Compact, sorted-key JSON. This is the byte sequence the bundle hash covers."
  @spec compact(term()) :: String.t()
  def compact(term), do: term |> encode(nil, 0) |> IO.iodata_to_binary()

  defp encode(nil, _indent, _depth), do: "null"
  defp encode(true, _indent, _depth), do: "true"
  defp encode(false, _indent, _depth), do: "false"
  defp encode(value, _indent, _depth) when is_integer(value), do: Integer.to_string(value)
  defp encode(value, _indent, _depth) when is_float(value), do: Jason.encode!(value)
  defp encode(value, _indent, _depth) when is_binary(value), do: Jason.encode!(value)

  defp encode(value, indent, depth) when is_atom(value),
    do: encode(Atom.to_string(value), indent, depth)

  defp encode([], _indent, _depth), do: "[]"

  defp encode(list, indent, depth) when is_list(list) do
    container("[", "]", Enum.map(list, &encode(&1, indent, depth + 1)), indent, depth)
  end

  defp encode(map, indent, depth) when is_map(map) do
    if map_size(map) == 0 do
      "{}"
    else
      members =
        map
        |> Enum.map(fn {k, v} -> {to_string(k), v} end)
        |> Enum.sort_by(&elem(&1, 0))
        |> Enum.map(fn {k, v} ->
          [Jason.encode!(k), ":", separator(indent), encode(v, indent, depth + 1)]
        end)

      container("{", "}", members, indent, depth)
    end
  end

  defp separator(nil), do: ""
  defp separator(_), do: " "

  defp container(open, close, members, nil, _depth) do
    [open, Enum.intersperse(members, ","), close]
  end

  defp container(open, close, members, indent, depth) do
    inner = String.duplicate(indent, depth + 1)
    outer = String.duplicate(indent, depth)
    [open, "\n", Enum.intersperse(Enum.map(members, &[inner, &1]), [",\n"]), "\n", outer, close]
  end
end

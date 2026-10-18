defmodule ToborKit.Compiler.Json do
  @moduledoc """
  Deterministic JSON serialization.

  `Jason` emits object members in map iteration order, which is stable for a
  given key set but is not something a golden file should depend on. Everything
  here sorts object keys, so both the bundle file and the bytes fed to the
  content hash are a pure function of the guide.
  """

  @doc "Compact, sorted-key JSON. This is the byte sequence the bundle hash covers."
  @spec compact(term()) :: String.t()
  def compact(term), do: term |> encode(nil, 0) |> IO.iodata_to_binary()

  @doc "Two-space-indented, sorted-key JSON with a trailing newline."
  @spec pretty(term()) :: String.t()
  def pretty(term), do: IO.iodata_to_binary([encode(term, "  ", 0), "\n"])

  defp encode(nil, _indent, _depth), do: "null"
  defp encode(true, _indent, _depth), do: "true"
  defp encode(false, _indent, _depth), do: "false"
  defp encode(value, _indent, _depth) when is_integer(value), do: Integer.to_string(value)
  defp encode(value, _indent, _depth) when is_float(value), do: Jason.encode!(value)
  defp encode(value, _indent, _depth) when is_binary(value), do: Jason.encode!(value)
  defp encode(value, indent, depth) when is_atom(value), do: encode(Atom.to_string(value), indent, depth)

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

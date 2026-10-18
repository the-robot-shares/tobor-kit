defmodule ToborKit.Hologram.Asset.Assets do
  @moduledoc """
  Host-owned asset snapshot helpers — port of `web/src/components/asset/asset.ts`.

  The kit never persists; the host supplies snapshots. All helpers are
  regex-free and client-transpilable (templates call them), including the
  `javascript:` URL guard (case-folded prefix check instead of the Lit
  regex).
  """

  @type mime_kind :: :image | :text | :other

  @doc "Lit `essentialMime`: strip parameters, trim, downcase."
  def essential_mime(mime) when is_binary(mime) do
    mime
    |> String.split(";")
    |> hd()
    |> String.trim()
    |> String.downcase()
  end

  def essential_mime(_mime), do: ""

  @doc "Lit `mimeKind`."
  def mime_kind(mime) do
    type = essential_mime(mime)

    cond do
      String.starts_with?(type, "image/") -> :image
      String.starts_with?(type, "text/") -> :text
      true -> :other
    end
  end

  def image_mime?(mime), do: mime_kind(mime) == :image
  def text_mime?(mime), do: mime_kind(mime) == :text

  @doc "Lit `textBody`: inline text for `text/*` preview/edit, never HTML-injected."
  def text_body(asset) do
    case get(asset, :body) do
      body when is_binary(body) -> body
      _ -> ""
    end
  end

  @doc """
  Lit `previewSrc`: reject `javascript:` URLs; the host `src` is otherwise
  passed through. Empty/blank → nil.
  """
  def preview_src(src) do
    if is_binary(src) do
      value = String.trim(src)

      cond do
        value == "" -> nil
        String.starts_with?(String.downcase(value), "javascript:") -> nil
        true -> value
      end
    else
      nil
    end
  end

  @doc "Dual-key tolerant map access (template-passed maps may be string-keyed)."
  def get(map, key) when is_map(map) do
    case Map.get(map, key) do
      nil -> Map.get(map, key_to_string(key))
      value -> value
    end
  end

  def get(_map, _key), do: nil

  defp key_to_string(key) when is_atom(key), do: Atom.to_string(key)
  defp key_to_string(key), do: key
end

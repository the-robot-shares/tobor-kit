defmodule ToborKit.Hologram.Npl.Tokenizer do
  @moduledoc """
  NPL / prompt-lingua tokenizer + fold splitter.

  Server-side port of `web/src/components/npl-view/highlight.ts`
  (`tokenizeNpl` / `splitNplSections` / `isNplFoldStart`). Regexes are fine
  here — this module only ever runs on the server (`init/3` of
  `ToborKit.Hologram.Npl.View`); client `action/3` code must stay regex-free
  (`docs/PORTING.md` §6.1).

  Highlighting is CSS classes on escaped text spans — callers must never feed
  raw source to any raw-HTML mechanism (the kit charter: no `unsafeHTML`
  anywhere; Hologram interpolates text escaped).
  """

  @sample_source """
  ⌜NPL@1.0⌝

  # Syntax
  Greet {user.name} with [...:1sentence| warm].
  Use 🎯 care.

  # Agent
  ⌜guide|agent|NPL@1.0⌝
  You are a helpful guide.
  {{if user.admin}}
  Admin tools are available.
  {{/if}}
  ⌞guide⌟
  """

  # Leftmost-match, first-alternative-wins — same semantics as the Lit
  # TOKEN_RE (`/.../gu`); PCRE shares the ordering.
  @token_re ~r/⌜[^⌜⌝\n]*⌝|⌞[^⌞⌟\n]*⌟|⟬[^⟬⟭]*⟭|\{\{\/?[^{}\n]*\}\}|<\/?npl-[a-zA-Z0-9-]+(?:\s[^>]*)?>|\{[^{}\n]+\}|\[[^\]]+\]|`[^`\n]+`|🎯/u

  @typedoc "Token kind — one per Lit `NplTokenKind`; the CSS class is `npl-<kind>`."
  @type kind ::
          :text
          | :declaration
          | :placeholder
          | :infill
          | :highlight
          | :attention
          | :logic
          | :literal
          | :tag

  @type token :: %{kind: kind(), text: String.t()}
  @type section :: %{heading: String.t() | nil, body: String.t()}

  @doc "Lit `SAMPLE_SOURCE` fixture, verbatim."
  @spec sample_source :: String.t()
  def sample_source, do: @sample_source

  @doc """
  Foldable heading: a line whose trimmed start is `#` or `⌜NPL`.
  (`isNplFoldStart`.)
  """
  @spec fold_start?(String.t()) :: boolean
  def fold_start?(line) do
    trimmed = String.trim_leading(line)
    String.starts_with?(trimmed, "#") or String.starts_with?(trimmed, "⌜NPL")
  end

  @doc """
  Split source into fold sections (`splitNplSections`): a section starts at
  each fold-start line (its `heading`) and runs until the next one. A leading
  run of blank/non-heading lines with only whitespace collapses away.
  """
  @spec split_sections(String.t()) :: [section()]
  def split_sections(source) do
    source
    |> String.split("\n")
    |> Enum.reduce(%{heading: nil, body: [], sections: []}, fn line, acc ->
      if fold_start?(line) do
        acc
        |> flush()
        |> Map.put(:heading, line)
      else
        Map.update!(acc, :body, &[line | &1])
      end
    end)
    |> flush()
    |> Map.fetch!(:sections)
    |> Enum.reverse()
  end

  # Lit `flush()`: a heading-less section whose body is only whitespace is
  # dropped; everything else is emitted.
  defp flush(%{heading: nil, body: body} = acc) do
    if body |> Enum.reverse() |> Enum.join("\n") |> String.trim() == "" do
      %{acc | body: []}
    else
      emit_section(acc)
    end
  end

  defp flush(acc), do: emit_section(acc)

  defp emit_section(%{heading: heading, body: body_rev} = acc) do
    section = %{heading: heading, body: body_rev |> Enum.reverse() |> Enum.join("\n")}
    %{acc | heading: nil, body: [], sections: [section | acc.sections]}
  end

  @doc """
  Tokenize source into kind/text spans (`tokenizeNpl`). Text between matches
  becomes `:text` tokens; matches are classified by `kind_of/1`.
  """
  @spec tokenize(String.t()) :: [token()]
  def tokenize(source) when is_binary(source) and source != "" do
    matches = Regex.scan(@token_re, source, return: :index)
    source_length = byte_size(source)

    {tokens, last} =
      Enum.reduce(matches, {[], 0}, fn [{index, length}], {acc, last} ->
        acc =
          if index > last do
            [{:text, binary_part(source, last, index - last)} | acc]
          else
            acc
          end

        text = binary_part(source, index, length)
        {[{kind_of(text), text} | acc], index + length}
      end)

    # Trailing plain text after the last match (the JS `last < source.length` slice).
    tokens =
      if last < source_length do
        [{:text, binary_part(source, last, source_length - last)} | tokens]
      else
        tokens
      end

    tokens
    |> Enum.reverse()
    |> Enum.map(fn {kind, text} -> %{kind: kind, text: text} end)
  end

  def tokenize(_source), do: []

  @doc "Classify one matched span (`kindOf`)."
  @spec kind_of(String.t()) :: kind()
  def kind_of(raw) do
    cond do
      String.starts_with?(raw, "⌜") or String.starts_with?(raw, "⌞") -> :declaration
      String.starts_with?(raw, "⟬") -> :literal
      String.starts_with?(raw, "{{") -> :logic
      String.starts_with?(raw, "<") -> :tag
      String.starts_with?(raw, "{") -> :placeholder
      String.starts_with?(raw, "[") -> :infill
      String.starts_with?(raw, "`") -> :highlight
      raw == "🎯" -> :attention
      true -> :text
    end
  end

  @doc "CSS class for a token (`npl-<kind>`), precomputed server-side."
  @spec token_class(token()) :: String.t()
  def token_class(%{kind: kind}), do: "npl-" <> Atom.to_string(kind)
end

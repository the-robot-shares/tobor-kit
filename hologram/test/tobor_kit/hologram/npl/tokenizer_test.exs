defmodule ToborKit.Hologram.Npl.TokenizerTest do
  # Plain ExUnit — the tokenizer is a pure server-side module.
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Npl.Tokenizer

  doctest ToborKit.Hologram.Npl.Tokenizer

  describe "fold_start?/1" do
    test "matches `#` headings regardless of leading whitespace" do
      assert Tokenizer.fold_start?("# Syntax")
      assert Tokenizer.fold_start?("   # indented")
    end

    test "matches the ⌜NPL declaration marker" do
      assert Tokenizer.fold_start?("⌜NPL@1.0⌝")
      assert Tokenizer.fold_start?("  ⌜NPL@2.0⌝")
    end

    test "rejects ordinary lines, bare ⌜ blocks, and blank lines" do
      refute Tokenizer.fold_start?("You are a helpful guide.")
      refute Tokenizer.fold_start?("⌜guide|agent|NPL@1.0⌝")
      refute Tokenizer.fold_start?("")
      refute Tokenizer.fold_start?("   ")
      refute Tokenizer.fold_start?("mid # heading marker not at trimmed start")
    end
  end

  describe "split_sections/1" do
    test "splits the sample source into a declaration + heading sections" do
      sections = Tokenizer.split_sections(Tokenizer.sample_source())

      assert [%{heading: "⌜NPL@1.0⌝"}, %{heading: "# Syntax"}, %{heading: "# Agent"}] = sections

      assert sections |> hd() |> Map.get(:body) == ""

      syntax = Enum.at(sections, 1)
      assert syntax.body =~ "Greet {user.name}"
      refute syntax.body =~ "# Agent"

      agent = Enum.at(sections, 2)
      assert agent.body =~ "⌜guide|agent|NPL@1.0⌝"
      assert agent.body =~ "⌞guide⌟"
    end

    test "drops a whitespace-only leading run with no heading" do
      assert Tokenizer.split_sections("\n\n\n# Head\nbody") == [
               %{heading: "# Head", body: "body"}
             ]
    end

    test "keeps a leading heading-less section that has content" do
      assert Tokenizer.split_sections("preamble\n# Head\nbody") == [
               %{heading: nil, body: "preamble"},
               %{heading: "# Head", body: "body"}
             ]
    end

    test "preserves blank lines inside a section body" do
      assert Tokenizer.split_sections("# Head\n\nbody\n") == [
               %{heading: "# Head", body: "\nbody\n"}
             ]
    end

    test "a trailing heading with no body yields an empty-body section" do
      assert Tokenizer.split_sections("# Head\nbody\n# Tail") == [
               %{heading: "# Head", body: "body"},
               %{heading: "# Tail", body: ""}
             ]
    end

    test "empty source yields no sections" do
      assert Tokenizer.split_sections("") == []
    end
  end

  describe "tokenize/1" do
    test "empty source yields no tokens" do
      assert Tokenizer.tokenize("") == []
    end

    test "plain text passes through as a single text token" do
      assert Tokenizer.tokenize("hello world") == [%{kind: :text, text: "hello world"}]
    end

    test "⌜…⌝ blocks are declarations" do
      assert Tokenizer.tokenize("⌜guide|agent|NPL@1.0⌝") == [
               %{kind: :declaration, text: "⌜guide|agent|NPL@1.0⌝"}
             ]
    end

    test "⌞…⌟ closers are declarations" do
      assert Tokenizer.tokenize("⌞guide⌟") == [%{kind: :declaration, text: "⌞guide⌟"}]
    end

    test "⟬…⟭ spans are literals" do
      assert Tokenizer.tokenize("⟬verbatim⟭") == [%{kind: :literal, text: "⟬verbatim⟭"}]
    end

    test "{{logic}} open/close tags are logic" do
      assert Tokenizer.tokenize("{{if user.admin}}") == [%{kind: :logic, text: "{{if user.admin}}"}]
      assert Tokenizer.tokenize("{{/if}}") == [%{kind: :logic, text: "{{/if}}"}]
    end

    test "<npl-*> tags are tags" do
      assert Tokenizer.tokenize("<npl-block>") == [%{kind: :tag, text: "<npl-block>"}]
      assert Tokenizer.tokenize("</npl-block>") == [%{kind: :tag, text: "</npl-block>"}]
      assert Tokenizer.tokenize("<npl-x attr=\"1\">") == [%{kind: :tag, text: "<npl-x attr=\"1\">"}]
    end

    test "{placeholder} tokens and [infill] tokens" do
      assert Tokenizer.tokenize("{user.name}") == [%{kind: :placeholder, text: "{user.name}"}]
      assert Tokenizer.tokenize("[...:1sentence| warm]") == [%{kind: :infill, text: "[...:1sentence| warm]"}]
    end

    test "`backtick` spans are highlights" do
      assert Tokenizer.tokenize("`exact`") == [%{kind: :highlight, text: "`exact`"}]
    end

    test "🎯 is attention" do
      assert Tokenizer.tokenize("🎯") == [%{kind: :attention, text: "🎯"}]
    end

    test "interleaves text and special tokens in order" do
      tokens = Tokenizer.tokenize("Greet {user.name} with [...:1sentence| warm].")

      assert tokens == [
               %{kind: :text, text: "Greet "},
               %{kind: :placeholder, text: "{user.name}"},
               %{kind: :text, text: " with "},
               %{kind: :infill, text: "[...:1sentence| warm]"},
               %{kind: :text, text: "."}
             ]
    end

    test "tokens do not cross newlines ({{…}} multiline-safe)" do
      tokens = Tokenizer.tokenize("{{if\nx}}")
      assert Enum.all?(tokens, &(&1.kind == :text))
    end

    test "token text concatenates back to the source" do
      source = Tokenizer.sample_source()
      round = source |> Tokenizer.tokenize() |> Enum.map(& &1.text) |> Enum.join("")
      assert round == source
    end
  end

  describe "kind_of/1" do
    test "falls back to text for unmatched input" do
      assert Tokenizer.kind_of("plain") == :text
    end
  end

  describe "token_class/1" do
    test "prefixes the kind with npl-" do
      assert Tokenizer.token_class(%{kind: :placeholder, text: "{x}"}) == "npl-placeholder"
    end
  end
end

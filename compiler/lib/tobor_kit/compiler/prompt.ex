defmodule ToborKit.Compiler.Prompt do
  @moduledoc """
  Assembles the agent declaration block from the guide's `agent:`,
  `capabilities:`, `orchestration:`, `dependencies:` and `npl:` blocks.

  `fields/1` returns the individual compiled prompt fields (what the OpenAPI
  `GuideProjection` exposes alongside `bundle_hash`); `render/1` joins the
  present ones into the block that follows the preamble.
  """

  @field_order ~w(header purpose identity self_image profile goals capabilities voice runtime flags secure body)

  @ocean_order ~w(openness conscientiousness extraversion agreeableness neuroticism)

  @doc "The compiled prompt fields, keyed by name. Absent fields are omitted."
  @spec fields(map()) :: %{String.t() => String.t()}
  def fields(guide) do
    core = Map.get(guide, "core", %{})
    agent = Map.get(guide, "agent", %{})
    npl = Map.get(guide, "npl", %{})

    %{
      "header" => header(core, npl),
      "purpose" => section("PURPOSE", text(Map.get(agent, "purpose"))),
      "identity" => section("IDENTITY", text(Map.get(agent, "biography"))),
      "self_image" => section("SELF-IMAGE", self_image(core, agent)),
      "profile" => section("PROFILE", profile(agent)),
      "goals" => section("GOALS", numbered(Map.get(agent, "goals", []))),
      "capabilities" => section("CAPABILITIES", capabilities(Map.get(guide, "capabilities", []))),
      "voice" => section("VOICE", voice(agent)),
      "runtime" => section("RUNTIME", runtime(guide)),
      "flags" => flags(Map.get(npl, "flags", %{})),
      "secure" => secure(Map.get(npl, "secure_block")),
      "body" => text(Map.get(npl, "body"))
    }
    |> Enum.reject(fn {_k, v} -> is_nil(v) end)
    |> Map.new()
  end

  @doc "The rendered agent block: header, present fields in order, closing marker."
  @spec render(map()) :: String.t()
  def render(guide) do
    compiled = fields(guide)
    slug = guide |> Map.get("core", %{}) |> Map.get("slug", "guide")

    body =
      @field_order
      |> Enum.map(&Map.get(compiled, &1))
      |> Enum.reject(&is_nil/1)
      |> Enum.join("\n\n")

    body <> "\n⌞" <> slug <> "⌟"
  end

  # ---------------------------------------------------------------------------

  defp header(core, npl) do
    version = Map.get(npl, "npl_version", "1.0")
    kind = Map.get(npl, "declaration_kind", "agent")
    slug = Map.get(core, "slug", "guide")

    lines =
      [
        "⌜#{slug}|#{kind}|NPL@#{version}⌝",
        "# #{Map.get(core, "name", slug)}",
        text(Map.get(core, "title")),
        tag_line(Map.get(core, "tags", []))
      ]
      |> Enum.reject(&is_nil/1)

    Enum.join(lines, "\n")
  end

  defp tag_line([]), do: nil
  defp tag_line(tags), do: "*tags: " <> Enum.join(tags, ", ") <> "*"

  defp self_image(core, agent) do
    personality = Map.get(agent, "personality") || %{}
    ocean = Map.get(personality, "ocean") || %{}

    ocean_line =
      case Enum.filter(@ocean_order, &Map.has_key?(ocean, &1)) do
        [] -> nil
        keys -> "- OCEAN: " <> Enum.map_join(keys, ", ", &"#{&1} #{Map.fetch!(ocean, &1)}")
      end

    [
      labelled("Archetype", Map.get(core, "archetype")),
      labelled("MBTI", Map.get(personality, "mbti")),
      labelled("Tone", Map.get(personality, "tone")),
      ocean_line
    ]
    |> lines()
  end

  defp profile(agent) do
    vs = Map.get(agent, "voice_signature") || %{}
    interests = Map.get(agent, "interests") || %{}

    [
      labelled("Voice", Map.get(vs, "style")),
      labelled_list("Quirks", Map.get(vs, "quirks", [])),
      labelled_list("Lexicon", Map.get(vs, "lexicon", [])),
      labelled_list("Patterns", Map.get(vs, "patterns", [])),
      labelled_list("Primary interests", Map.get(interests, "primary", [])),
      labelled_list("Secondary interests", Map.get(interests, "secondary", []))
    ]
    |> lines()
  end

  defp capabilities([]), do: nil

  defp capabilities(caps) do
    rows =
      Enum.map(caps, fn cap ->
        "| `#{Map.get(cap, "id", "")}` | #{Map.get(cap, "description", "")} | #{cell(Map.get(cap, "inputs", []))} | #{cell(Map.get(cap, "outputs", []))} |"
      end)

    Enum.join(
      ["| id | what it does | inputs | outputs |", "| --- | --- | --- | --- |" | rows],
      "\n"
    )
  end

  defp cell([]), do: "—"
  defp cell(values), do: Enum.join(values, ", ")

  # `voice_signature.example_lines` become the few-shot thread. The schema is
  # explicit that they must not be duplicated by hand into an examples section.
  defp voice(agent) do
    vs = Map.get(agent, "voice_signature") || %{}

    case Map.get(vs, "example_lines", []) do
      [] ->
        nil

      lines ->
        messages =
          Enum.map_join(lines, "\n", fn line ->
            "<msg role=\"assistant\">\n#{String.trim(line)}\n</msg>"
          end)

        "How this guide speaks — reproduce the register, not the sentences:\n\n<npl-example>\n<thread>\n#{messages}\n</thread>\n</npl-example>"
    end
  end

  defp runtime(guide) do
    orch = Map.get(guide, "orchestration", %{})
    deps = Map.get(guide, "dependencies", %{})

    [
      labelled("Max turns", Map.get(orch, "max_turns")),
      labelled("Turn timeout (s)", Map.get(orch, "timeout_seconds")),
      labelled("Retries", Map.get(orch, "retry_count")),
      labelled(
        "Internal tool steps before emitting to the user",
        Map.get(orch, "max_internal_tool_steps")
      ),
      labelled_list("Expected tools", Map.get(deps, "tools", [])),
      labelled_list("Expected guides", Map.get(deps, "guides", []))
    ]
    |> lines()
  end

  # `⌜🏳️ … ⌟` — the runtime-flags special section. Keys are sorted so the
  # bundle does not inherit YAML/map iteration order.
  defp flags(flags) when map_size(flags) == 0, do: nil

  defp flags(flags) do
    body =
      flags
      |> Enum.sort_by(fn {k, _} -> to_string(k) end)
      |> Enum.map_join("\n", fn {k, v} -> "#{k}: #{scalar(v)}" end)

    "⌜🏳️\n#{body}\n⌟"
  end

  # `⌜🔒 … ⌟` — highest-precedence secure section.
  defp secure(nil), do: nil

  defp secure(block) do
    case String.trim(block) do
      "" -> nil
      trimmed -> "⌜🔒\n#{trimmed}\n⌟"
    end
  end

  # ---------------------------------------------------------------------------

  defp section(_title, nil), do: nil
  defp section(title, body), do: "## #{title}\n\n#{body}"

  defp text(nil), do: nil

  defp text(value) when is_binary(value) do
    case String.trim(value) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  defp lines(entries) do
    case Enum.reject(entries, &is_nil/1) do
      [] -> nil
      present -> Enum.join(present, "\n")
    end
  end

  defp labelled(_label, nil), do: nil
  defp labelled(label, value) when is_binary(value), do: labelled_string(label, String.trim(value))
  defp labelled(label, value), do: "- #{label}: #{scalar(value)}"

  defp labelled_string(_label, ""), do: nil
  defp labelled_string(label, value), do: "- #{label}: #{value}"

  defp labelled_list(_label, []), do: nil
  defp labelled_list(_label, nil), do: nil
  defp labelled_list(label, values), do: "- #{label}: " <> Enum.join(values, ", ")

  defp numbered([]), do: nil

  defp numbered(items) do
    items
    |> Enum.with_index(1)
    |> Enum.map_join("\n", fn {item, i} -> "#{i}. #{String.trim(item)}" end)
  end

  defp scalar(value) when is_binary(value), do: value
  defp scalar(value), do: inspect(value)
end

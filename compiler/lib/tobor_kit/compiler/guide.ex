defmodule ToborKit.Compiler.Guide do
  @moduledoc """
  Loads, validates, and default-fills a `tobor.guide-definition` v1 document.

  Validation is total: every offending key path is collected and reported
  together. Nothing here raises on malformed input.
  """

  alias ToborKit.Compiler.Error

  @slug_pattern ~r/^[a-z0-9]+(-[a-z0-9]+)*$/
  @mbti_pattern ~r/^[IE][NS][TF][PJ]$/

  @ocean_keys ~w(openness conscientiousness extraversion agreeableness neuroticism)
  @core_status ~w(draft active suspended archived)
  @declaration_kinds ~w(agent persona tool service)
  @layouts ~w(yaml_order classic grouped)
  @ui_modes ~w(voice text transcript)
  @renderers ~w(lottie sprite glyph)
  @reduced_motion ~w(respect force_static ignore)
  @placements ~w(floating docked inline)
  @group_by ~w(category server none)
  @auth_providers ~w(oidc authentik none)
  @telemetry_defaults ~w(on off)
  @voice_adapters ~w(realtime native backend none)
  @transcript_stores ~w(memory local backend)

  @doc "Read a guide YAML file from disk, then `validate/1`."
  @spec load(Path.t()) :: {:ok, map()} | {:error, Error.t()}
  def load(path) do
    cond do
      not File.exists?(path) ->
        {:error, Error.new(:input, "Guide file not found: #{path}")}

      true ->
        case YamlElixir.read_from_file(path) do
          {:ok, data} when is_map(data) ->
            validate(data)

          {:ok, _other} ->
            {:error, Error.new(:input, "Guide file is not a YAML mapping: #{path}")}

          {:error, reason} ->
            {:error, Error.new(:yaml, "Invalid YAML in #{path}: #{inspect(reason)}")}
        end
    end
  end

  @doc "Validate a decoded guide document and fill in schema defaults."
  @spec validate(map()) :: {:ok, map()} | {:error, Error.t()}
  def validate(doc) when is_map(doc) do
    case issues(doc) do
      [] -> {:ok, normalize(doc)}
      issues -> {:error, Error.new(:validation, "Guide definition failed validation:", issues)}
    end
  end

  # ---------------------------------------------------------------------------
  # Validation
  # ---------------------------------------------------------------------------

  defp issues(doc) do
    List.flatten([
      envelope_issues(doc),
      core_issues(get(doc, "core")),
      agent_issues(get(doc, "agent")),
      capability_issues(Map.get(doc, "capabilities")),
      orchestration_issues(get(doc, "orchestration")),
      npl_issues(get(doc, "npl")),
      mcp_issues(get(doc, "mcp")),
      ui_issues(get(doc, "ui")),
      auth_issues(get(doc, "auth")),
      telemetry_issues(get(doc, "telemetry")),
      voice_issues(get(doc, "voice")),
      transcript_issues(get(doc, "transcript"))
    ])
  end

  defp envelope_issues(doc) do
    schema = Map.get(doc, "schema")
    version = Map.get(doc, "version")

    [
      if(schema not in [nil, "tobor.guide-definition"],
        do: issue("schema", "must be \"tobor.guide-definition\", got #{inspect(schema)}")
      ),
      if(version not in [nil, 1], do: issue("version", "must be 1, got #{inspect(version)}"))
    ]
    |> compact()
  end

  defp core_issues(nil), do: [issue("core", "is required")]

  defp core_issues(core) when not is_map(core), do: [issue("core", "must be a mapping")]

  defp core_issues(core) do
    [
      required_string(core, "core", "slug"),
      pattern(core, "core", "slug", @slug_pattern, "must be kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$)"),
      required_string(core, "core", "name"),
      required_string(core, "core", "organization"),
      optional_string(core, "core", "title"),
      optional_string(core, "core", "archetype"),
      optional_string(core, "core", "project"),
      optional_string(core, "core", "model"),
      enum(core, "core", "status", @core_status),
      string_list(core, "core", "tags")
    ]
    |> compact()
  end

  defp agent_issues(nil), do: [issue("agent", "is required")]
  defp agent_issues(agent) when not is_map(agent), do: [issue("agent", "must be a mapping")]

  defp agent_issues(agent) do
    [
      required_string(agent, "agent", "purpose"),
      required_string(agent, "agent", "biography"),
      personality_issues(get(agent, "personality")),
      voice_signature_issues(get(agent, "voice_signature")),
      interests_issues(get(agent, "interests")),
      string_list(agent, "agent", "goals")
    ]
    |> compact()
  end

  defp personality_issues(nil), do: nil

  defp personality_issues(p) when not is_map(p),
    do: issue("agent.personality", "must be a mapping")

  defp personality_issues(p) do
    ocean = get(p, "ocean")

    ocean_issues =
      cond do
        is_nil(ocean) ->
          []

        not is_map(ocean) ->
          [issue("agent.personality.ocean", "must be a mapping")]

        true ->
          unknown =
            ocean
            |> Map.keys()
            |> Enum.reject(&(&1 in @ocean_keys))
            |> Enum.map(
              &issue("agent.personality.ocean.#{&1}", "unknown trait; expected one of #{list(@ocean_keys)}")
            )

          ranged =
            ocean
            |> Enum.filter(fn {k, _} -> k in @ocean_keys end)
            |> Enum.reject(fn {_k, v} -> is_integer(v) and v >= 0 and v <= 100 end)
            |> Enum.map(fn {k, v} ->
              issue("agent.personality.ocean.#{k}", "must be an integer 0..100, got #{inspect(v)}")
            end)

          unknown ++ ranged
      end

    mbti =
      case get(p, "mbti") do
        nil -> nil
        v when is_binary(v) -> if Regex.match?(@mbti_pattern, v), do: nil, else: issue("agent.personality.mbti", "must match ^[IE][NS][TF][PJ]$, got #{inspect(v)}")
        v -> issue("agent.personality.mbti", "must be a string, got #{inspect(v)}")
      end

    compact([ocean_issues, mbti, optional_string(p, "agent.personality", "tone")])
  end

  defp voice_signature_issues(nil), do: nil

  defp voice_signature_issues(vs) when not is_map(vs),
    do: issue("agent.voice_signature", "must be a mapping")

  defp voice_signature_issues(vs) do
    lines = Map.get(vs, "example_lines")

    line_issues =
      cond do
        is_nil(lines) ->
          nil

        not is_list(lines) ->
          issue("agent.voice_signature.example_lines", "must be an array of strings")

        not Enum.all?(lines, &is_binary/1) ->
          issue("agent.voice_signature.example_lines", "must be an array of strings")

        length(lines) < 3 ->
          issue("agent.voice_signature.example_lines", "requires at least 3 entries, got #{length(lines)}")

        true ->
          nil
      end

    compact([
      optional_string(vs, "agent.voice_signature", "style"),
      string_list(vs, "agent.voice_signature", "quirks"),
      string_list(vs, "agent.voice_signature", "lexicon"),
      string_list(vs, "agent.voice_signature", "patterns"),
      line_issues
    ])
  end

  defp interests_issues(nil), do: nil

  defp interests_issues(i) when not is_map(i), do: issue("agent.interests", "must be a mapping")

  defp interests_issues(i) do
    Enum.map(["primary", "secondary"], fn key ->
      case Map.get(i, key) do
        nil ->
          nil

        v when is_list(v) ->
          cond do
            not Enum.all?(v, &is_binary/1) ->
              issue("agent.interests.#{key}", "must be an array of strings")

            length(v) < 2 ->
              issue("agent.interests.#{key}", "requires at least 2 entries, got #{length(v)}")

            true ->
              nil
          end

        _ ->
          issue("agent.interests.#{key}", "must be an array of strings")
      end
    end)
    |> compact()
  end

  defp capability_issues(nil), do: []
  defp capability_issues(caps) when not is_list(caps), do: [issue("capabilities", "must be an array")]

  defp capability_issues(caps) do
    caps
    |> Enum.with_index()
    |> Enum.map(fn {cap, idx} ->
      base = "capabilities[#{idx}]"

      if not is_map(cap) do
        issue(base, "must be a mapping")
      else
        compact([
          required_string(cap, base, "id"),
          pattern(cap, base, "id", @slug_pattern, "must be kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$)"),
          required_string(cap, base, "description"),
          string_list(cap, base, "inputs"),
          string_list(cap, base, "outputs")
        ])
      end
    end)
    |> compact()
  end

  defp orchestration_issues(nil), do: []

  defp orchestration_issues(o) when not is_map(o),
    do: [issue("orchestration", "must be a mapping")]

  defp orchestration_issues(o) do
    ~w(max_turns timeout_seconds retry_count max_internal_tool_steps)
    |> Enum.map(&positive_integer(o, "orchestration", &1))
    |> compact()
  end

  defp npl_issues(nil), do: []
  defp npl_issues(npl) when not is_map(npl), do: [issue("npl", "must be a mapping")]

  defp npl_issues(npl) do
    preamble = get(npl, "preamble")

    preamble_issues =
      cond do
        is_nil(preamble) ->
          []

        not is_map(preamble) ->
          [issue("npl.preamble", "must be a mapping")]

        true ->
          compact([
            enum(preamble, "npl.preamble", "layout", @layouts),
            string_list(preamble, "npl.preamble", "skip"),
            non_negative_integer(preamble, "npl.preamble", "component_priority"),
            non_negative_integer(preamble, "npl.preamble", "example_priority"),
            boolean(preamble, "npl.preamble", "extension")
          ])
      end

    flags_issues =
      case Map.get(npl, "flags") do
        nil -> []
        f when is_map(f) -> []
        _ -> [issue("npl.flags", "must be a mapping")]
      end

    compact([
      optional_string(npl, "npl", "npl_version"),
      enum(npl, "npl", "declaration_kind", @declaration_kinds),
      string_list(npl, "npl", "pumps"),
      string_list(npl, "npl", "syntax"),
      string_list(npl, "npl", "prompt_sections"),
      optional_string(npl, "npl", "secure_block"),
      optional_string(npl, "npl", "body"),
      preamble_issues,
      flags_issues
    ])
  end

  defp mcp_issues(nil), do: []
  defp mcp_issues(mcp) when not is_map(mcp), do: [issue("mcp", "must be a mapping")]

  defp mcp_issues(mcp) do
    servers =
      case Map.get(mcp, "servers") do
        nil ->
          []

        list when is_list(list) ->
          list
          |> Enum.with_index()
          |> Enum.map(fn {srv, idx} ->
            base = "mcp.servers[#{idx}]"

            if is_map(srv) do
              compact([
                required_string(srv, base, "id"),
                required_string(srv, base, "url"),
                optional_string(srv, base, "label"),
                string_list(srv, base, "scopes"),
                boolean(srv, base, "required")
              ])
            else
              issue(base, "must be a mapping")
            end
          end)

        _ ->
          [issue("mcp.servers", "must be an array")]
      end

    menu =
      case get(mcp, "menu") do
        nil -> []
        m when is_map(m) -> compact([enum(m, "mcp.menu", "group_by", @group_by), string_list(m, "mcp.menu", "order")])
        _ -> [issue("mcp.menu", "must be a mapping")]
      end

    compact([servers, menu, string_list(mcp, "mcp", "allow"), string_list(mcp, "mcp", "deny")])
  end

  defp ui_issues(nil), do: []
  defp ui_issues(ui) when not is_map(ui), do: [issue("ui", "must be a mapping")]

  defp ui_issues(ui) do
    modes =
      case Map.get(ui, "modes") do
        nil ->
          []

        list when is_list(list) ->
          list
          |> Enum.with_index()
          |> Enum.map(fn {m, i} ->
            if m in @ui_modes,
              do: nil,
              else: issue("ui.modes[#{i}]", "must be one of #{list(@ui_modes)}, got #{inspect(m)}")
          end)

        _ ->
          [issue("ui.modes", "must be an array")]
      end

    robot =
      case get(ui, "robot") do
        nil ->
          []

        r when is_map(r) ->
          compact([
            enum(r, "ui.robot", "renderer", @renderers),
            enum(r, "ui.robot", "reduced_motion", @reduced_motion),
            optional_string(r, "ui.robot", "asset")
          ])

        _ ->
          [issue("ui.robot", "must be a mapping")]
      end

    panel =
      case get(ui, "panel") do
        nil -> []
        p when is_map(p) -> compact([enum(p, "ui.panel", "placement", @placements), optional_string(p, "ui.panel", "greeting")])
        _ -> [issue("ui.panel", "must be a mapping")]
      end

    compact([modes, robot, panel, enum(ui, "ui", "default_mode", @ui_modes)])
  end

  defp auth_issues(nil), do: []
  defp auth_issues(auth) when not is_map(auth), do: [issue("auth", "must be a mapping")]

  defp auth_issues(auth) do
    compact([
      enum(auth, "auth", "provider", @auth_providers),
      boolean(auth, "auth", "required"),
      boolean(auth, "auth", "pkce"),
      optional_string(auth, "auth", "issuer"),
      optional_string(auth, "auth", "client_id"),
      optional_string(auth, "auth", "redirect_path"),
      string_list(auth, "auth", "scopes")
    ])
  end

  defp telemetry_issues(nil), do: []
  defp telemetry_issues(t) when not is_map(t), do: [issue("telemetry", "must be a mapping")]

  defp telemetry_issues(t) do
    capture =
      case get(t, "capture") do
        nil ->
          []

        c when is_map(c) ->
          ~w(prompt response tool_args tool_results)
          |> Enum.map(&boolean(c, "telemetry.capture", &1))

        _ ->
          [issue("telemetry.capture", "must be a mapping")]
      end

    compact([
      boolean(t, "telemetry", "enabled"),
      boolean(t, "telemetry", "user_overridable"),
      enum(t, "telemetry", "default", @telemetry_defaults),
      string_list(t, "telemetry", "redact"),
      optional_string(t, "telemetry", "service_name"),
      capture
    ])
  end

  defp voice_issues(nil), do: []
  defp voice_issues(v) when not is_map(v), do: [issue("voice", "must be a mapping")]

  defp voice_issues(v) do
    compact([
      enum(v, "voice", "adapter", @voice_adapters),
      boolean(v, "voice", "push_to_talk")
    ])
  end

  defp transcript_issues(nil), do: []
  defp transcript_issues(t) when not is_map(t), do: [issue("transcript", "must be a mapping")]

  defp transcript_issues(t) do
    compact([
      enum(t, "transcript", "store", @transcript_stores),
      positive_integer(t, "transcript", "retain_turns")
    ])
  end

  # ---------------------------------------------------------------------------
  # Validation primitives
  # ---------------------------------------------------------------------------

  defp issue(path, message), do: %{path: path, message: message}

  defp compact(list) do
    list |> List.flatten() |> Enum.reject(&is_nil/1)
  end

  defp list(values), do: Enum.join(values, ", ")

  defp get(map, key) when is_map(map), do: Map.get(map, key)
  defp get(_, _), do: nil

  defp required_string(map, base, key) do
    case Map.get(map, key) do
      nil -> issue("#{base}.#{key}", "is required")
      v when is_binary(v) -> if String.trim(v) == "", do: issue("#{base}.#{key}", "must not be blank"), else: nil
      v -> issue("#{base}.#{key}", "must be a string, got #{inspect(v)}")
    end
  end

  defp optional_string(map, base, key) do
    case Map.get(map, key) do
      nil -> nil
      v when is_binary(v) -> nil
      v -> issue("#{base}.#{key}", "must be a string, got #{inspect(v)}")
    end
  end

  defp pattern(map, base, key, regex, message) do
    case Map.get(map, key) do
      v when is_binary(v) -> if Regex.match?(regex, v), do: nil, else: issue("#{base}.#{key}", "#{message}, got #{inspect(v)}")
      _ -> nil
    end
  end

  defp enum(map, base, key, values) do
    case Map.get(map, key) do
      nil -> nil
      v -> if v in values, do: nil, else: issue("#{base}.#{key}", "must be one of #{list(values)}, got #{inspect(v)}")
    end
  end

  defp boolean(map, base, key) do
    case Map.get(map, key) do
      nil -> nil
      v when is_boolean(v) -> nil
      v -> issue("#{base}.#{key}", "must be a boolean, got #{inspect(v)}")
    end
  end

  defp positive_integer(map, base, key) do
    case Map.get(map, key) do
      nil -> nil
      v when is_integer(v) and v > 0 -> nil
      v -> issue("#{base}.#{key}", "must be a positive integer, got #{inspect(v)}")
    end
  end

  defp non_negative_integer(map, base, key) do
    case Map.get(map, key) do
      nil -> nil
      v when is_integer(v) and v >= 0 -> nil
      v -> issue("#{base}.#{key}", "must be a non-negative integer, got #{inspect(v)}")
    end
  end

  defp string_list(map, base, key) do
    case Map.get(map, key) do
      nil -> nil
      v when is_list(v) -> if Enum.all?(v, &is_binary/1), do: nil, else: issue("#{base}.#{key}", "must be an array of strings")
      v -> issue("#{base}.#{key}", "must be an array of strings, got #{inspect(v)}")
    end
  end

  # ---------------------------------------------------------------------------
  # Defaults
  # ---------------------------------------------------------------------------

  defp normalize(doc) do
    npl = get(doc, "npl") || %{}
    preamble = get(npl, "preamble") || %{}

    Map.merge(doc, %{
      "schema" => "tobor.guide-definition",
      "version" => 1,
      "core" => defaults(get(doc, "core") || %{}, %{"tags" => [], "status" => "draft"}),
      "agent" => normalize_agent(get(doc, "agent") || %{}),
      "capabilities" => Enum.map(Map.get(doc, "capabilities") || [], &defaults(&1, %{"inputs" => [], "outputs" => []})),
      "dependencies" => defaults(get(doc, "dependencies") || %{}, %{"guides" => [], "tools" => []}),
      "orchestration" =>
        defaults(get(doc, "orchestration") || %{}, %{
          "max_turns" => 32,
          "timeout_seconds" => 120,
          "retry_count" => 1,
          "max_internal_tool_steps" => 5
        }),
      "npl" =>
        npl
        |> defaults(%{
          "npl_version" => "1.0",
          "declaration_kind" => "agent",
          "pumps" => [],
          "syntax" => [],
          "flags" => %{},
          "prompt_sections" => []
        })
        |> Map.put(
          "preamble",
          defaults(preamble, %{
            "layout" => "yaml_order",
            "skip" => [],
            "component_priority" => 0,
            "example_priority" => 0,
            "extension" => false
          })
        )
    })
  end

  defp normalize_agent(agent) do
    agent
    |> defaults(%{"goals" => []})
    |> Map.put(
      "voice_signature",
      case get(agent, "voice_signature") do
        nil -> nil
        vs -> defaults(vs, %{"quirks" => [], "lexicon" => [], "patterns" => [], "example_lines" => []})
      end
    )
  end

  defp defaults(map, defaults) do
    Enum.reduce(defaults, map, fn {k, v}, acc ->
      if Map.get(acc, k) == nil, do: Map.put(acc, k, v), else: acc
    end)
  end
end

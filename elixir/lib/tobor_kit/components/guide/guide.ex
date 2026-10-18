defmodule ToborKit.Guide do
  @moduledoc """
  A frozen NPL bundle, verified and projected.

  `load/1` decodes a compiled `*.bundle.json`, re-derives `bundle_hash` over
  the body minus the hash member (`ToborKit.Json.compact/1` + sha256), and
  rejects the bundle on any mismatch. A tampered or truncated bundle never
  reaches the prompt.

  The bundle carries the prompt-facing half of the guide (core, npl,
  preamble, prompt, prompt_fields). The runtime-facing half (ui, auth,
  telemetry, voice, transcript, mcp) lives in host configuration —
  `config :tobor_kit, ToborKit.Guide.Store, config: %{...}` — and is merged
  into the projection here.
  """

  @bundle_schema "tobor.guide-bundle"
  @bundle_version 1

  @modes ~w(voice text transcript)

  defstruct [:bundle, :config]

  @type t :: %__MODULE__{bundle: map(), config: map()}

  @doc "Load and hash-verify a bundle from a file path or a decoded map."
  @spec load(Path.t() | map()) :: {:ok, t()} | {:error, term()}
  def load(%{"schema" => _} = bundle), do: verify(bundle)

  def load(path) when is_binary(path) do
    with {:ok, raw} <- File.read(path),
         {:ok, bundle} <- Jason.decode(raw) do
      load(bundle)
    end
  end

  def load(_), do: {:error, :invalid_bundle}

  @doc """
  Verify `bundle_hash` exactly as the compiler computed it: sha256 hex with a
  `sha256:` prefix, over compact sorted-key JSON of the bundle minus the
  `bundle_hash` member.
  """
  @spec verify(map()) :: {:ok, t()} | {:error, term()}
  def verify(%{"schema" => schema, "version" => version} = bundle)
      when is_binary(schema) and is_integer(version) do
    claimed = Map.get(bundle, "bundle_hash")

    body = Map.delete(bundle, "bundle_hash")

    actual =
      "sha256:" <>
        (:sha256 |> :crypto.hash(ToborKit.Json.compact(body)) |> Base.encode16(case: :lower))

    cond do
      not is_binary(claimed) ->
        {:error, :bundle_hash_missing}

      schema != @bundle_schema or version > @bundle_version ->
        {:error, {:unsupported_bundle, schema, version}}

      not Plug.Crypto.secure_compare(claimed, actual) ->
        {:error, :bundle_hash_mismatch}

      true ->
        {:ok, %__MODULE__{bundle: bundle, config: default_config()}}
    end
  end

  def verify(_), do: {:error, :invalid_bundle}

  @doc "Merge host runtime config (ui/auth/telemetry/voice/transcript/mcp) into a guide."
  def with_config(%__MODULE__{} = guide, config) when is_map(config) do
    %{guide | config: deep_merge(guide.config, config)}
  end

  @doc "The assembled system prompt (compiled preamble + prompt fields)."
  def system_prompt(%__MODULE__{bundle: %{"prompt" => prompt}}) when is_binary(prompt), do: prompt
  def system_prompt(_), do: ""

  @doc "The `bundle_hash` clients echo in bug reports."
  def bundle_hash(%__MODULE__{bundle: %{"bundle_hash" => hash}}), do: hash

  @doc """
  The UI-facing config projection (`GET /guide`): everything the client
  renders, nothing it must not see. No preamble, no biography, no model ids,
  no credentials.
  """
  @spec projection(t()) :: map()
  def projection(%__MODULE__{} = guide) do
    cfg = guide.config
    core = guide.bundle["core"] || %{}
    ui = fetch(cfg, "ui")
    telemetry_cfg = fetch(cfg, "telemetry")

    %{
      "slug" => core["slug"],
      "name" => core["name"],
      "title" => core["title"],
      "greeting" => get_in(ui, ["panel", "greeting"]),
      "bundle_hash" => bundle_hash(guide),
      "capabilities" => capabilities(cfg),
      "modes" => modes(cfg),
      "default_mode" => default_mode(cfg),
      "ui" => %{
        "robot" => %{
          "renderer" => robot_renderer(get_in(ui, ["robot", "renderer"]), get_in(ui, ["robot", "asset"])),
          "asset" => get_in(ui, ["robot", "asset"]),
          "states" => get_in(ui, ["robot", "states"]) || %{},
          "reduced_motion" => get_in(ui, ["robot", "reduced_motion"]) || "respect"
        },
        "panel" => %{
          "placement" => get_in(ui, ["panel", "placement"]) || "floating",
          "start_expanded" => get_in(ui, ["panel", "start_expanded"]) || false,
          "show_tool_list" => get_in(ui, ["panel", "show_tool_list"]) || false,
          "show_task_menu" => get_in(ui, ["panel", "show_task_menu"]) || false
        },
        "theme" => get_in(ui, ["theme"]) || %{}
      },
      "auth" => auth_projection(fetch(cfg, "auth")),
      "telemetry" => %{
        "enabled" => ToborKit.Telemetry.Consent.default_enabled?(telemetry_cfg),
        "default" => Map.get(telemetry_cfg, "default") || "off",
        "user_overridable" =>
          Map.get(telemetry_cfg, "enabled") != false and Map.get(telemetry_cfg, "user_overridable") != false
      },
      "voice" => %{
        "adapter" => Map.get(fetch(cfg, "voice"), "adapter") || "none",
        "push_to_talk" => Map.get(fetch(cfg, "voice"), "push_to_talk") == true,
        "mint_path" => "/api/tobor-kit/voice/token",
        "locale" => Map.get(fetch(cfg, "voice"), "locale")
      },
      "transcript" => %{
        "store" => Map.get(fetch(cfg, "transcript"), "store") || "memory",
        "retain_turns" => Map.get(fetch(cfg, "transcript"), "retain_turns") || 200
      }
    }
  end

  # lottie/sprite without an asset would leave the client with nothing to
  # play — degrade to the glyph renderer instead of projecting the ask.
  defp robot_renderer(renderer, asset) when renderer in ["lottie", "sprite"] do
    if is_binary(asset) and asset != "", do: renderer, else: "glyph"
  end

  defp robot_renderer(renderer, _asset) when is_binary(renderer) and renderer != "", do: renderer

  defp robot_renderer(_, _), do: "glyph"

  # ── internals ─────────────────────────────────────────────────────────────

  defp capabilities(cfg) do
    cfg
    |> fetch("capabilities")
    |> case do
      caps when is_list(caps) ->
        Enum.flat_map(caps, fn
          %{"id" => id} = cap when is_binary(id) ->
            [%{"id" => id, "description" => Map.get(cap, "description")}]

          %{id: id} = cap when is_binary(id) ->
            [%{"id" => id, "description" => Map.get(cap, :description)}]

          _ ->
            []
        end)

      _ ->
        []
    end
  end

  defp modes(cfg),
    do: Enum.filter(Map.get(fetch(cfg, "ui"), "modes") || ["text"], &(&1 in @modes))

  defp default_mode(cfg) do
    case Map.get(fetch(cfg, "ui"), "default_mode") do
      mode when mode in @modes -> mode
      _ -> List.first(modes(cfg)) || "text"
    end
  end

  defp auth_projection(auth) do
    %{
      "required" => Map.get(auth, "required") == true,
      "provider" => Map.get(auth, "provider") || "none",
      "issuer" => Map.get(auth, "issuer"),
      "client_id" => Map.get(auth, "client_id"),
      "scopes" => Map.get(auth, "scopes") || [],
      "redirect_path" => Map.get(auth, "redirect_path")
    }
  end

  defp default_config do
    %{
      "ui" => %{},
      "auth" => %{},
      "telemetry" => %{},
      "voice" => %{},
      "transcript" => %{},
      "mcp" => %{}
    }
  end

  defp fetch(cfg, key) do
    case Map.fetch(cfg, key) do
      {:ok, value} ->
        value

      :error ->
        atom = String.to_existing_atom(key)
        Map.get(cfg, atom, %{})
    end
  rescue
    ArgumentError -> Map.get(cfg, key, %{})
  end

  defp deep_merge(base, override) when is_map(base) and is_map(override) do
    Map.merge(base, override, fn
      _k, b, o when is_map(b) and is_map(o) -> deep_merge(b, o)
      _k, _b, o -> o
    end)
  end
end

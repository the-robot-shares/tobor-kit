defmodule ToborKit.VoiceGateway.Config do
  @moduledoc """
  Server-side session policy. `authorize_config/2` is the port of the Node
  gateway's `authorizeConfig`: it validates the browser-requested session
  configuration against the authenticated caller's policy and returns the
  exact permitted scope. Browser tool definitions are never trusted — only
  names, resolved against the server catalog.
  """

  @scope_fields ~w(organization project engine backend model)
  @optional_string_fields ~w(voice ttsModel)

  @doc """
  Returns `{:ok, config}` with the normalized string-keyed session config, or
  `{:error, status, code, message}` (400 `invalid_config` / 403 `forbidden`).
  """
  def authorize_config(requested, policy)
      when is_map(requested) and not is_map_key(requested, :__struct__) do
    with :ok <- scope(requested, policy),
         {:ok, selected} <- tools(requested, policy),
         {:ok, prompt} <- system_prompt(requested, policy),
         :ok <- optional_strings(requested) do
      {:ok,
       %{
         "organization" => requested["organization"],
         "project" => requested["project"],
         "engine" => requested["engine"],
         "backend" => requested["backend"],
         "model" => requested["model"],
         "voice" => requested["voice"],
         "ttsModel" => requested["ttsModel"],
         "systemPrompt" => prompt,
         "tools" =>
           Enum.map(selected, fn name -> policy["tools"][name] |> Map.put("name", name) end),
         "mcpTools" => requested["mcpTools"] || []
       }}
    end
  end

  def authorize_config(_, _),
    do: {:error, 400, "invalid_config", "Expected session configuration"}

  defp scope(requested, policy) do
    Enum.reduce_while(@scope_fields, :ok, fn field, :ok ->
      value = requested[field]

      cond do
        not is_binary(value) or value == "" or byte_size(value) > 256 ->
          {:halt, {:error, 400, "invalid_config", "#{field} is required"}}

        not Enum.member?(policy["#{field}s"] || [], value) ->
          {:halt, {:error, 403, "forbidden", "#{field} is not allowed"}}

        true ->
          {:cont, :ok}
      end
    end)
  end

  defp tools(requested, policy) do
    with {:ok, names} <- name_list(requested["tools"]),
         {:ok, mcp} <- name_list(requested["mcpTools"]),
         :ok <- allowlisted(Enum.uniq(names ++ mcp), policy) do
      {:ok, Enum.uniq(names ++ mcp)}
    end
  end

  defp name_list(nil), do: {:ok, []}

  defp name_list(names) when is_list(names) and length(names) <= 100 do
    if Enum.all?(names, &(is_binary(&1) and byte_size(&1) < 256)),
      do: {:ok, names},
      else: {:error, 400, "invalid_config", "Tools must be arrays of names"}
  end

  defp name_list(_), do: {:error, 400, "invalid_config", "Tools must be arrays of names"}

  defp allowlisted(names, policy) do
    catalog = policy["tools"] || %{}

    Enum.reduce_while(names, :ok, fn name, :ok ->
      if is_map_key(catalog, name),
        do: {:cont, :ok},
        else: {:halt, {:error, 403, "forbidden", "Tool #{name} is not allowed"}}
    end)
  end

  defp system_prompt(requested, policy) do
    default = policy["systemPrompt"] || ""
    prompt = if is_binary(requested["systemPrompt"]), do: requested["systemPrompt"], else: default

    cond do
      not is_binary(prompt) or byte_size(prompt) > 32_000 ->
        {:error, 400, "invalid_config", "Invalid system prompt"}

      policy["allowSystemPrompt"] != true and prompt != default ->
        {:error, 403, "forbidden", "System prompt override is disabled"}

      true ->
        {:ok, prompt}
    end
  end

  defp optional_strings(requested) do
    Enum.reduce_while(@optional_string_fields, :ok, fn field, :ok ->
      case requested[field] do
        nil -> {:cont, :ok}
        value when is_binary(value) and byte_size(value) <= 128 -> {:cont, :ok}
        _ -> {:halt, {:error, 400, "invalid_config", "Invalid #{field}"}}
      end
    end)
  end

  @doc """
  OpenAI/Realtime tool naming: plain names pass through; anything else gets a
  deterministic `tool_<sha256[:24]>` alias so dotted names stay provider-safe
  without expanding access.
  """
  def function_name(name) when is_binary(name) do
    if Regex.match?(~r/^[A-Za-z0-9_-]{1,64}$/, name),
      do: name,
      else:
        "tool_" <> binary_part(Base.encode16(:crypto.hash(:sha256, name), case: :lower), 0, 24)
  end

  @doc "Resolve a requested/announced tool name against the session allowlist."
  def resolve_tool(tools, name) when is_list(tools) and is_binary(name) do
    Enum.find(tools, fn tool ->
      tool["name"] == name or
        (is_map_key(tool, "name") and function_name(tool["name"]) == function_name(name))
    end)
  end

  def resolve_tool(_, _), do: nil
end

defmodule ToborKit.VoiceGateway.Provider do
  @moduledoc """
  Engine implementation seam. One module per voice engine; the gateway calls
  it from the per-turn task process. All callbacks return values — coded
  errors as `{:error, {code :: String.t(), message :: String.t()}}`, anything
  else surfaces as a generic `provider_error`.

  Frames are emitted asynchronously: `emit` in the ctx sends a wire frame
  (string-keyed map) to the socket, which drops it when the turn has been
  superseded or interrupted. Cancellation is enforced by the gateway — an
  interrupt kills the turn task outright, so callbacks need no cooperative
  abort checks.

  Shared context (`ctx`) map:

    * `:config` — authorized session config (string-keyed)
    * `:emit` — `frame :: map() -> :ok` (gateway adds the turn id)
    * `:scope` — `%{organization:, project:}` for tool invocations
  """

  @callback respond(ctx :: map()) :: {:ok, reply :: String.t()} | {:error, term()}

  @callback transcribe(data :: binary(), mime :: String.t(), ctx :: map()) ::
              {:ok, text :: String.t()} | {:error, term()}

  @callback speak(text :: String.t(), ctx :: map()) :: :ok | {:error, term()}

  @callback mint_realtime(config :: map()) :: {:ok, credential :: map()} | {:error, term()}

  @callback invoke_tool(tool :: map(), args :: map(), ctx :: map()) ::
              {:ok, result :: term()} | {:error, term()}

  @doc "Resolve an announced tool name against the session allowlist."
  @callback resolve_tool(tools :: [map()], name :: String.t()) :: map() | nil

  @optional_callbacks [resolve_tool: 2]

  @doc "Default resolution: exact name or the sanitized function-name alias."
  def resolve_tool(tools, name), do: ToborKit.VoiceGateway.Config.resolve_tool(tools, name)

  @doc """
  Default tool invocation: catalog tools carry a server-side `invoke`
  callback — `fun/2` called as `(args, scope)`, or `{mod, fun, extra}` called
  as `apply(mod, fun, [args | extra])`. Remote-MCP endpoint tools are not yet
  ported from the Node gateway; hosts bridge them through `invoke` (e.g. via
  `NoizuMCP`) or provide `{mod, fun, extra}` adapters.
  """
  def invoke_tool(tool, args, ctx) when is_map(tool) do
    case Map.get(tool, "invoke") do
      fun when is_function(fun, 2) ->
        {:ok, fun.(args, ctx.scope)}

      {mod, fun, extra} when is_atom(mod) and is_atom(fun) and is_list(extra) ->
        {:ok, apply(mod, fun, [args | extra])}

      _ ->
        {:error, {"tool_unconfigured", "Tool has no server adapter"}}
    end
  end
end

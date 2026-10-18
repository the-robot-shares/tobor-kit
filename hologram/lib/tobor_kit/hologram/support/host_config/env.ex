defmodule ToborKit.Hologram.HostConfig.Env do
  @moduledoc """
  Default `ToborKit.Hologram.HostConfig` implementation.

  Reads the scope → config map from
  `Application.get_env(:tobor_kit_hologram, :host_config, %{})`. Hosts
  that prefer env-var plumbing over explicit config typically populate
  it in `config/runtime.exs`:

      config :tobor_kit_hologram, :host_config,
        tobor_kit_api: %{
          base_url: System.fetch_env!("TOBOR_KIT_API_URL"),
          token: System.fetch_env!("TOBOR_KIT_API_TOKEN")
        }

  Unknown scopes raise `ArgumentError` — a command asking for config the
  host never wired is a bug, not an empty-map situation.
  """

  @behaviour ToborKit.Hologram.HostConfig

  @impl true
  def resolve(scope) when is_atom(scope) do
    config = Application.get_env(:tobor_kit_hologram, :host_config, [])

    case Keyword.get(config, scope) do
      nil ->
        raise ArgumentError,
              "no host_config entry for scope #{inspect(scope)} — set " <>
                "config :tobor_kit_hologram, :host_config, #{inspect(scope)}: %{...}"

      value when is_map(value) ->
        value

      other ->
        raise ArgumentError,
              "host_config entry for scope #{inspect(scope)} must be a map, got: " <>
                inspect(other)
    end
  end
end

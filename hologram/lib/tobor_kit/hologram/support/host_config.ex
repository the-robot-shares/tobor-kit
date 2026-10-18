defmodule ToborKit.Hologram.HostConfig do
  @moduledoc """
  Server-side host configuration resolution for server-coupled mirrors.

  Hologram props/state live on the CLIENT — anything placed in them is
  client-visible. The Lit kit rule "components carry no secrets" therefore
  translates to: endpoints and API keys are resolved SERVER-side inside
  `command/3` handlers via `resolve/1`, and never accepted through props,
  params, or client state.

  ## Scopes

    * `:tobor_kit_api` — base_url + token for the tobor-kit backend API
    * `:llm_providers` — per-provider base_url + api_key_spec map
    * `:waitlist_api` — base_url + token for the waitlist API
    * `:catalog` — base_url (+ auth, if any) for the product catalog
    * `:auth` — OIDC client secret + canonical redirect_uri/origin for the
      login-flow token exchange (public PKCE client_id/scopes ride props;
      only the secret half lives here)

  ## Host wiring

  Hosts implement the behaviour (or use the `Env` default) and point the
  mirror app at it:

      # config/runtime.exs (host app)
      config :tobor_kit_hologram, :host_config_module, MyApp.HostConfig

  The default implementation `ToborKit.Hologram.HostConfig.Env` reads
  `Application.get_env(:tobor_kit_hologram, :host_config)` — a map of
  scope → config map. See the README for a full example.
  """

  @scopes [:tobor_kit_api, :llm_providers, :waitlist_api, :catalog, :auth]

  @callback resolve(scope :: atom) :: map

  @doc "Scopes recognized by the mirror's command handlers."
  @spec scopes :: [atom]
  def scopes, do: @scopes

  @doc """
  Resolves `scope` through the host-configured implementation.

  Reads `Application.get_env(:tobor_kit_hologram, :host_config_module)`
  (defaults to `ToborKit.Hologram.HostConfig.Env`) and calls `resolve/1`
  on it at execution time — inside `command/3`, never during render and
  never client-side.
  """
  @spec resolve(atom) :: map
  def resolve(scope) when is_atom(scope) do
    module = Application.get_env(:tobor_kit_hologram, :host_config_module, __MODULE__.Env)
    module.resolve(scope)
  end

  @doc """
  Raises if a params map carries a key colliding with a reserved secret
  name. Command params come from the client — a `base_url`, `token`, or
  `api_key` key there is either a spoofing attempt or a design mistake
  (someone tried to pass config through the wire). Call at the top of
  every `command/3` clause that accepts free-form params.

      params = HostConfig.from_params!(params)

  Returns the params unchanged when clean.
  """
  @spec from_params!(%{optional(atom | String.t()) => any}) ::
          %{optional(atom | String.t()) => any}
  def from_params!(params) when is_map(params) do
    Enum.each(params, fn {key, _value} ->
      if reserved_key?(key) do
        raise ArgumentError,
              "reserved secret key #{inspect(key)} in command params — " <>
                "resolve server-side via #{inspect(__MODULE__)}.resolve/1 instead"
      end
    end)

    params
  end

  # Keys that must never arrive from the client. Atom keys are the runtime
  # shape; the string spellings cover client-serialized params round-trips.
  @reserved ~w(base_url token api_key api_key_spec authorization)a

  defp reserved_key?(key) when is_atom(key), do: key in @reserved
  defp reserved_key?(key) when is_binary(key), do: key in Enum.map(@reserved, &Atom.to_string/1)
  defp reserved_key?(_), do: false
end

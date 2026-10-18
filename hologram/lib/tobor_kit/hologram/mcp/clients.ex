defmodule ToborKit.Hologram.Mcp.Clients do
  @moduledoc """
  Mirror of `<tobor-mcp-clients>` (registry: `mcp-clients` family) — MCP
  client roster (OAuth / API key). Contract class B (normalized snapshot in
  init/3; no internal toggle state — the Lit element is purely presentational).

  Lit events `client-authorize` / `client-revoke` `{id}` → item bindings
  `$click={action: :client_authorize, params: %{id: row.id}, target: @target}`
  / `:client_revoke`. OAuth redirect is host-owned; this island never
  assigns `location` and never stores secrets. **Backend: none. Host owns
  OAuth redirect, API-key issuance and revocation.**
  """

  use Hologram.Component

  alias ToborKit.Hologram.Data.Tools

  @auths ["oauth", "api-key"]

  prop :clients, :list, default: []
  prop :target, :string, default: "parent"

  def template do
    ~HOLO"""
    <div class="tk tk-mcp-clients" data-cy="mcp.clients">
      {%if @rows != []}
        <ul class="tk-mcp-clients__list">
          {%for row <- @rows}
            <li class="tk-mcp-clients__client" data-client-id={row.id} data-auth={row.auth}>
              <span class="tk-mcp-clients__name">{row.name}</span>
              <span class="tk-mcp-clients__meta">
                <span class="tk-mcp-clients__status" data-kind={row.kind}>{row.status}</span>
                · {row.auth_label}
              </span>
              <span class="tk-mcp-clients__actions">
                <button
                  type="button"
                  class="tk-mcp-clients__authorize"
                  data-cy="mcp.authorize"
                  data-client-id={row.id}
                  $click={action: :client_authorize, params: %{id: row.id}, target: @target}
                >
                  Authorize
                </button>
                <button
                  type="button"
                  class="tk-mcp-clients__revoke"
                  data-cy="mcp.revoke"
                  data-client-id={row.id}
                  $click={action: :client_revoke, params: %{id: row.id}, target: @target}
                >
                  Revoke
                </button>
              </span>
            </li>
          {/for}
        </ul>
      {%else}
        <p class="muted tk-mcp-clients__empty">No clients.</p>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    put_state(component, target: props.target, rows: normalize_clients(props.clients))
  end

  # -- init-only normalization (server-side; regex is welcome here) --

  @doc "Normalizes the clients roster (port of `normalizeClients` + `status` kind)."
  @spec normalize_clients(any) :: [map]
  def normalize_clients(clients) when is_list(clients) do
    for row <- clients, is_map(row) do
      id = String.trim(Tools.to_s(Tools.fetch(row, :id)))

      if id != "" do
        name = Tools.fetch(row, :name) || id
        status = Tools.fetch(row, :status) || "disconnected"
        auth = normalize_auth(Tools.fetch(row, :auth))
        status_s = String.trim(Tools.to_s(status))

        %{
          id: id,
          name: Tools.to_s(name),
          status: status_s,
          kind: status_kind(status_s),
          auth: auth,
          auth_label: if(auth == "api-key", do: "API key", else: "OAuth")
        }
      else
        nil
      end
    end
    |> Enum.reject(&is_nil/1)
  end

  def normalize_clients(_), do: []

  @doc "Clamps auth to the registry union (`oauth` | `api-key`; default `oauth`)."
  @spec normalize_auth(any) :: String.t()
  def normalize_auth(auth) when auth in @auths, do: auth
  def normalize_auth(_), do: "oauth"

  # Lit: `status.trim().toLowerCase().replace(/\s+/g, '_')` — server-side only.
  defp status_kind(status) do
    String.replace(String.downcase(status), ~r/\s+/, "_")
  end
end

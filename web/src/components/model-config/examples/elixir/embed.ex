# Phoenix host: serve <noizu-model-config> and echo TRK-shaped
# GET /api/v1/ai/models + GET/PATCH /api/v1/ai/settings.
# Empty api_key on PATCH keeps the stored key. Never log keys.
# Persistence is in-process (Agent) — replace with the host store.

defmodule ModelConfigEmbedWeb.Router do
  use Phoenix.Router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", ModelConfigEmbedWeb do
    pipe_through :browser
    get "/", PageController, :index
  end

  scope "/api/v1/ai", ModelConfigEmbedWeb do
    pipe_through :api
    get "/models", SettingsController, :models
    get "/settings", SettingsController, :show
    patch "/settings", SettingsController, :update
  end
end

defmodule ModelConfigEmbedWeb.PageController do
  use Phoenix.Controller, formats: [:html]

  def index(conn, _params) do
    html(conn, """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>noizu-model-config</title>
        <script type="importmap">
          {"imports":{
            "lit":"https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js",
            "lit/decorators.js":"https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"
          }}
        </script>
      </head>
      <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
        <noizu-model-config id="model" catalog-url="/api/v1/ai/models" inherit allow-custom allow-budget></noizu-model-config>
        <script type="module">
          import 'https://cdn.derobot.is/tobor-kit/latest/components/model-config/noizu-model-config.js';
          const el = document.querySelector('#model');
          const patch = (ai) => fetch('/api/v1/ai/settings', {
            method: 'PATCH', headers: {'Content-Type':'application/json'},
            credentials: 'same-origin', body: JSON.stringify({ai})
          });
          fetch('/api/v1/ai/settings', {credentials:'same-origin'})
            .then((r) => r.json())
            .then(({ai}) => {
              el.value = ai.model || '';
              el.budget = ai.monthly_budget_cents;
              if (ai.custom_endpoint) {
                el.customEndpoint = {
                  baseUrl: ai.custom_endpoint.base_url,
                  model: ai.custom_endpoint.model,
                  apiKey: ai.custom_endpoint.api_key
                };
              }
            });
          el.addEventListener('model-change', (e) => patch({model: e.detail.value}));
          el.addEventListener('budget-change', (e) => patch({monthly_budget_cents: e.detail.amount}));
          el.addEventListener('custom-endpoint-save', (e) => {
            const {baseUrl, model, apiKey} = e.detail;
            patch({custom_endpoint: {base_url: baseUrl, model, api_key: apiKey}});
          });
        </script>
      </body>
    </html>
    """)
  end
end

defmodule ModelConfigEmbedWeb.SettingsController do
  use Phoenix.Controller, formats: [:json]

  def models(conn, _params) do
    json(conn, %{
      models: [
        %{provider: "openai", model: "gpt-4o", label: "GPT-4o", spec: "openai:gpt-4o"},
        %{provider: "anthropic", model: "claude-3-5", label: "Claude 3.5", spec: "anthropic:claude-3-5"}
      ]
    })
  end

  def show(conn, _params) do
    json(conn, %{ai: ModelConfigEmbed.Store.public()})
  end

  def update(conn, %{"ai" => attrs}) do
    json(conn, %{ai: ModelConfigEmbed.Store.patch(attrs)})
  end

  def update(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "ai params required"})
  end
end

defmodule ModelConfigEmbed.Store do
  use Agent

  def start_link(_opts) do
    Agent.start_link(fn -> %{model: "openai:gpt-4o", monthly_budget_cents: 1000, used_cents: 0, custom: nil, key: ""} end,
      name: __MODULE__
    )
  end

  def public do
    Agent.get(__MODULE__, fn s ->
      custom =
        case s.custom do
          nil -> nil
          c -> Map.put(c, :api_key, mask(s.key))
        end

      %{model: s.model, monthly_budget_cents: s.monthly_budget_cents, used_cents: s.used_cents, custom_endpoint: custom}
    end)
  end

  def patch(attrs) do
    Agent.get_and_update(__MODULE__, fn s ->
      key =
        case get_in(attrs, ["custom_endpoint", "api_key"]) || get_in(attrs, [:custom_endpoint, :api_key]) do
          nil -> s.key
          "" -> s.key
          incoming -> incoming
        end

      custom =
        case attrs["custom_endpoint"] || attrs[:custom_endpoint] do
          nil -> s.custom
          c -> %{base_url: c["base_url"] || c[:base_url], model: c["model"] || c[:model]}
        end

      next = %{
        model: attrs["model"] || attrs[:model] || s.model,
        monthly_budget_cents: attrs["monthly_budget_cents"] || attrs[:monthly_budget_cents] || s.monthly_budget_cents,
        used_cents: s.used_cents,
        custom: custom,
        key: key
      }

      {public_from(next), next}
    end)
  end

  defp public_from(s) do
    custom = if s.custom, do: Map.put(s.custom, :api_key, mask(s.key)), else: nil
    %{model: s.model, monthly_budget_cents: s.monthly_budget_cents, used_cents: s.used_cents, custom_endpoint: custom}
  end

  defp mask(""), do: ""
  defp mask(key) when is_binary(key), do: "••••" <> String.slice(key, -4, 4)
end

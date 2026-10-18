import Config

config :logger, level: :warning

# Point the OTel SDK at a pid exporter so tests can assert on span attributes
# without a collector. `ToborKit.TestSupport.OtelCollector` registers the name.
config :opentelemetry,
  processors: [
    {:otel_simple_processor, %{exporter: {:otel_exporter_pid, :tobor_kit_otel_test}}}
  ]

config :tobor_kit, ToborKit.Guide.Store,
  path: Path.expand("../test/fixtures/deploy-guide.bundle.json", __DIR__),
  config: %{
    "ui" => %{
      "modes" => ["text", "voice", "transcript"],
      "default_mode" => "text",
      "robot" => %{"renderer" => "lottie", "asset" => "./assets/tobor-companion.lottie"},
      "panel" => %{"placement" => "floating", "show_tool_list" => true, "show_task_menu" => true}
    },
    "auth" => %{"required" => false, "provider" => "authentik"},
    "telemetry" => %{
      "default" => "on",
      "user_overridable" => true,
      "capture" => %{
        "prompt" => true,
        "response" => true,
        "tool_args" => false,
        "tool_results" => false
      },
      "redact" => ["(?i)bearer\\s+[a-z0-9._-]+", "(?i)\\bsk-[a-z0-9]{16,}\\b"]
    },
    "voice" => %{"adapter" => "none", "push_to_talk" => false},
    "transcript" => %{"store" => "memory", "retain_turns" => 200},
    "mcp" => %{
      "servers" => [
        %{
          "id" => "tobor",
          "url" => "https://tobor.locker/mcp",
          "label" => "Tobor",
          "required" => true
        }
      ],
      "allow" => ["Github.*", "Ticket.*", "Session.*"],
      "deny" => ["Github.PullMerge"],
      "menu" => %{
        "group_by" => "category",
        "order" => ["Github", "Tickets", "Sessions"],
        "overrides" => %{
          "Github.PullCreate" => %{"label" => "Open a PR", "group" => "Github", "confirm" => true},
          "Ticket.Create" => %{"label" => "File a ticket"}
        }
      }
    }
  }

# Fake MCP source: no network in tests. `ToborKit.MCP.Source.Fake` serves this.
config :tobor_kit, ToborKit.MCP.Source, impl: ToborKit.MCP.Source.Fake

# Fake voice: realtime mint with an injected http fn is exercised in the voice
# test itself; guide voice adapter above is "none" so /voice/token 503s there.
config :tobor_kit, ToborKit.Provider, impl: ToborKit.Provider.Fake

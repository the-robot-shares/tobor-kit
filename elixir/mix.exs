defmodule ToborKit.MixProject do
  use Mix.Project

  @version "0.1.0"

  def project do
    [
      app: :tobor_kit,
      version: @version,
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      elixirc_paths: elixirc_paths(Mix.env()),
      deps: deps(),
      docs: docs(),
      description: description(),
      package: package()
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {ToborKit.Application, []}
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      {:jason, "~> 1.4"},
      {:plug, "~> 1.16"},
      {:bandit, "~> 1.5"},
      {:websock, "~> 0.5"},
      {:req, "~> 0.5"},
      {:jose, "~> 1.11"},
      {:noizu_mcp, "~> 0.5.3"},
      {:opentelemetry, "~> 1.5"},
      {:opentelemetry_exporter, "~> 1.8"}
    ]
  end

  defp docs do
    [main: "ToborKit", source_ref: "v#{@version}"]
  end

  defp description do
    "Reference backend for tobor-kit: serves frozen NPL guide bundles over the tobor-kit Guide API."
  end

  defp package do
    [
      licenses: ["MIT"],
      links: %{"GitHub" => "https://github.com/the-robot-lives/tobor-kit"}
    ]
  end
end

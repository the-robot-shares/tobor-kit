defmodule ToborKit.Hologram.MixProject do
  use Mix.Project

  @version "0.1.1"

  def project do
    [
      app: :tobor_kit_hologram,
      version: @version,
      description: "Native Elixir Hologram mirrors of the tobor-kit Lit web components.",
      elixir: "~> 1.15",
      elixirc_paths: elixirc_paths(Mix.env()),
      compilers: Mix.compilers() ++ hologram_compilers(Mix.env()),
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  # The Hologram compiler builds page bundles for the app that owns the pages.
  # As a dependency (Mix compiles deps in :prod) the library has none: the
  # host's compiler walks every loaded app, this library included, and emits
  # the bundles. Running it here as well only wrote a stray runtime bundle
  # into the library's own priv/static/hologram. The library's test suite
  # (gallery fixture pages) still needs it.
  defp hologram_compilers(:prod), do: []
  defp hologram_compilers(_env), do: [:hologram]

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      # Isomorphic UI (mirrors of the Lit components in web/).
      #
      # `runtime: false` — a component library, not a Hologram app. In a
      # release (no Mix), Hologram.Reflection.otp_app/0 takes THE one loaded
      # application whose .app `applications` lists :hologram, and badmatches
      # when there are two: the host crash-looped at boot with
      # `{badmatch, [:tobor_kit_hologram, host]}`. Keeping :hologram out of
      # this library's `applications` leaves the host as the only candidate.
      # The code dependency is unchanged (the modules still compile against
      # and call Hologram); the host depends on :hologram itself, which puts
      # it in the release and starts it. test_helper starts it for the
      # library's own suite (Hologram.Test.setup/0).
      {:hologram, "~> 0.10.0", runtime: false},
      # hologram requires gproc ~> 1.0; opentelemetry_exporter → grpcbox pins ~> 0.9.1
      # (pin inherited from the hologram-start-app scaffold; keep in sync)
      {:gproc, "~> 1.0", override: true},

      # Server-side HTTP for command/3 handlers (never reaches the client bundle)
      {:req, "~> 0.5"},

      # Test (unrestricted :only — hologram itself needs jason in :prod)
      {:jason, "~> 1.4"}
    ]
  end
end

defmodule ConsumerApp.MixProject do
  @moduledoc """
  Fixture host app: the smallest Hologram app that depends on
  `tobor_kit_hologram` the way a portfolio product does (path dep, its own
  `:hologram` dep and compiler). `ToborKit.Hologram.ConsumerAppTest` builds a
  prod release of it and boots it, so a library change that breaks a real
  consumer (the `Hologram.Reflection.otp_app/0` single-app badmatch) fails the
  library's own suite.

  Deps come from the library's lockfile, and `deps` is a symlink to the
  library's deps dir (the test creates it; Hologram's compiler reads
  `<root>/deps/hologram/assets`, so a `deps_path` override does not work).
  """
  use Mix.Project

  def project do
    [
      app: :consumer_app,
      version: "0.0.0",
      elixir: "~> 1.15",
      compilers: Mix.compilers() ++ [:hologram],
      lockfile: "../../mix.lock",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      releases: [consumer_app: [include_executables_for: [:unix]]]
    ]
  end

  def application do
    [mod: {ConsumerApp.Application, []}, extra_applications: [:logger]]
  end

  defp deps do
    [
      {:hologram, "~> 0.10.0"},
      {:gproc, "~> 1.0", override: true},
      {:plug, "~> 1.15"},
      {:tobor_kit_hologram, path: "../.."}
    ]
  end
end

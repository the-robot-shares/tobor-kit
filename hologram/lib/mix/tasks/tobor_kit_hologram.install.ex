defmodule Mix.Tasks.ToborKitHologram.Install do
  @shortdoc "Copies tobor-kit.css into the host app's priv/static/css/"
  @moduledoc """
  Installs the tobor-kit Hologram mirror stylesheet into a host application.

      mix tobor_kit_hologram.install

  Copies `priv/static/tobor-kit.css` from this app into the host's
  `priv/static/css/tobor-kit.css` (creating the directory if needed), then
  prints the one-line `<link>` tag the host layout needs.

  Hosts that prefer the path/git dependency form point `:tobor_kit_hologram`
  at this repo; either way the stylesheet ships with the app's `priv/`.
  Re-run this task after upgrading the dependency.
  """

  use Mix.Task

  @impl Mix.Task
  def run(_args) do
    source = Application.app_dir(:tobor_kit_hologram, "priv/static/tobor-kit.css")
    target_dir = Path.expand("priv/static/css")
    target = Path.join(target_dir, "tobor-kit.css")

    unless File.exists?(source) do
      Mix.raise("tobor-kit.css not found at #{source} — run `mix compile` first")
    end

    File.mkdir_p!(target_dir)
    File.cp!(source, target)

    Mix.shell().info("Copied #{source}")
    Mix.shell().info("to     #{target}")
    Mix.shell().info("")
    Mix.shell().info("Reference it from your Hologram layout:")
    Mix.shell().info(~s{  <link rel="stylesheet" href="/css/tobor-kit.css" />})
  end
end

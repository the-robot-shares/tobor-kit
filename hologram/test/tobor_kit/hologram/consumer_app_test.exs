defmodule ToborKit.Hologram.ConsumerAppTest do
  @moduledoc """
  A host app that depends on this library must compile, assemble a prod
  release, and boot it (fixtures/consumer_app).

  Regression: with :hologram as a runtime application of this library, the
  release's boot crashed in Hologram.Router.PageModuleResolver with
  `{badmatch, [:tobor_kit_hologram, :consumer_app]}` — Hologram.Reflection's
  release-mode otp_app/0 expects exactly one app listing :hologram
  (therobot.institute PR #27 carried a release-step workaround for it).

  Slow (a prod compile + release), so tagged; run alone with
  `mix test --only consumer_app`, skip with `--exclude consumer_app`.
  """
  use ExUnit.Case, async: false

  @moduletag :consumer_app
  @moduletag timeout: 600_000

  @root Path.expand("../../..", __DIR__)
  @fixture Path.join(@root, "fixtures/consumer_app")

  setup_all do
    # Hologram's compiler reads <root>/deps/hologram/assets, so the fixture
    # needs a real `deps` path: point it at this library's deps (same lock).
    deps = Path.join(@fixture, "deps")
    if match?({:ok, _}, File.read_link(deps)), do: File.rm!(deps)
    :ok = File.ln_s(Path.join(@root, "deps"), deps)
    on_exit(fn -> File.rm(deps) end)
    :ok
  end

  test "a consumer app compiles, assembles a release and boots with the library" do
    # The fixture resolves against the library's lockfile and deps; it must
    # never change them. `--check-locked` refuses to rewrite mix.lock, and the
    # lock is compared byte-for-byte after the build.
    lock = Path.join(@root, "mix.lock")
    lock_before = File.read!(lock)
    env = [{"MIX_ENV", "prod"}]
    run!("mix", ["deps.get", "--check-locked"], env)
    run!("mix", ["release", "--overwrite", "--quiet"], env)
    assert File.read!(lock) == lock_before, "the fixture build rewrote the library's mix.lock"

    bin = Path.join(@fixture, "_build/prod/rel/consumer_app/bin/consumer_app")

    {out, status} =
      System.cmd(bin, ["eval", "ConsumerApp.Probe.run()"],
        env: [{"HOLOGRAM_ENV", "prod"}, {"SECRET_KEY_BASE", String.duplicate("k", 64)}],
        stderr_to_stdout: true
      )

    probe =
      out
      |> String.split("\n")
      |> Enum.find_value(fn line ->
        with "PROBE " <> term <- line, do: term |> Code.eval_string() |> elem(0)
      end)

    assert status == 0, "release did not boot cleanly:\n#{out}"
    assert probe, "release printed no PROBE line:\n#{out}"
    assert probe.otp_app == :consumer_app
    assert probe.hologram_apps == [:consumer_app]
    assert probe.status == 200
    assert probe.rendered_kit_component
  end

  defp run!(cmd, args, env) do
    {out, status} = System.cmd(cmd, args, cd: @fixture, env: env, stderr_to_stdout: true)
    assert status == 0, "#{cmd} #{Enum.join(args, " ")} failed:\n#{out}"
    out
  end
end

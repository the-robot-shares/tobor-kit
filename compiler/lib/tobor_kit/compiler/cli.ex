defmodule ToborKit.Compiler.CLI do
  @moduledoc """
  `tobor-kit-compile <guide.yaml> --out dist/`
  """

  alias ToborKit.Compiler
  alias ToborKit.Compiler.Error

  @switches [out: :string, conventions_dir: :string, strict: :boolean, quiet: :boolean, help: :boolean]
  @aliases [o: :out, h: :help]

  @usage """
  tobor-kit-compile <guide.yaml> [options]

    --out DIR              output directory (default: dist)
    --conventions-dir DIR  override the vendored NPL convention set
    --strict               fail on unresolvable NPL terms instead of warning
    --quiet                only print errors
    -h, --help             this message
  """

  @spec main([String.t()]) :: no_return()
  def main(argv) do
    {opts, args, invalid} = OptionParser.parse(argv, switches: @switches, aliases: @aliases)

    cond do
      opts[:help] ->
        IO.puts(@usage)
        System.halt(0)

      invalid != [] ->
        die("Unknown option: #{invalid |> Enum.map(&elem(&1, 0)) |> Enum.join(", ")}\n\n#{@usage}")

      args == [] ->
        die("Expected a guide YAML path.\n\n#{@usage}")

      length(args) > 1 ->
        die("Expected exactly one guide YAML path, got #{length(args)}.\n\n#{@usage}")

      true ->
        run(hd(args), opts)
    end
  end

  defp run(path, opts) do
    out = Keyword.get(opts, :out, "dist")
    compile_opts = Keyword.take(opts, [:strict, :conventions_dir])

    case Compiler.compile_file(path, compile_opts) do
      {:ok, bundle} ->
        case Compiler.write(bundle, out) do
          {:ok, written} -> report(bundle, written, opts)
          {:error, err} -> die(Error.format(err))
        end

      {:error, err} ->
        die(Error.format(err))
    end
  end

  defp report(bundle, written, opts) do
    unless opts[:quiet] do
      IO.puts("#{written}")
      IO.puts("  hash:       #{bundle["bundle_hash"]}")
      IO.puts("  components: #{length(bundle["components"])} (#{length(bundle["derived_components"])} pulled in by require:)")

      Enum.each(bundle["warnings"], &IO.puts("  warning:    #{&1}"))
    end

    System.halt(0)
  end

  defp die(message) do
    IO.puts(:stderr, message)
    System.halt(1)
  end
end

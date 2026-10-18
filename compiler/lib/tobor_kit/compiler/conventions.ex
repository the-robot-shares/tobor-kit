defmodule ToborKit.Compiler.Conventions do
  @moduledoc """
  Locates the vendored NPL convention YAML files.

  The convention bodies are embedded at compile time so a built escript is
  self-contained (an escript has no `priv/` at runtime). When `priv/` *is*
  reachable — i.e. running under `mix` — that directory is used directly and
  nothing is written to disk.
  """

  @conventions_path Path.expand("../../../priv/conventions", __DIR__)

  @files @conventions_path
         |> Path.join("*.yaml")
         |> Path.wildcard()
         |> Enum.sort()
         |> Enum.map(fn path -> {Path.basename(path), File.read!(path)} end)

  for {name, _} <- @files do
    @external_resource Path.join(@conventions_path, name)
  end

  @digest @files
          |> Enum.map(fn {name, body} -> name <> "\0" <> body end)
          |> Enum.join("\0")
          |> then(&:crypto.hash(:sha256, &1))
          |> Base.encode16(case: :lower)
          |> binary_part(0, 16)

  @doc "Digest of the embedded convention set. Part of the bundle provenance."
  @spec digest() :: String.t()
  def digest, do: @digest

  @doc "Names of the embedded convention files."
  @spec files() :: [String.t()]
  def files, do: Enum.map(@files, &elem(&1, 0))

  @doc """
  Absolute path to a directory holding the convention YAML files.

  Prefers the package's own `priv/conventions`; falls back to materializing the
  embedded copies into a digest-named temp directory (escript path).
  """
  @spec dir() :: String.t()
  def dir do
    case priv_conventions() do
      path when is_binary(path) -> path
      nil -> materialize()
    end
  end

  defp priv_conventions do
    candidates =
      case :code.priv_dir(:tobor_kit_compiler) do
        {:error, _} -> [@conventions_path]
        priv -> [Path.join(to_string(priv), "conventions"), @conventions_path]
      end

    Enum.find(candidates, &File.exists?(Path.join(&1, "npl.yaml")))
  end

  defp materialize do
    dir = Path.join(System.tmp_dir!(), "tobor-kit-conventions-" <> @digest)

    unless File.exists?(Path.join(dir, "npl.yaml")) do
      File.mkdir_p!(dir)
      Enum.each(@files, fn {name, body} -> File.write!(Path.join(dir, name), body) end)
    end

    dir
  end
end

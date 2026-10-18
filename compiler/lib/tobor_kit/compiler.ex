defmodule ToborKit.Compiler do
  @moduledoc """
  Compiles a `tobor.guide-definition` YAML document into a frozen NPL system
  prompt bundle.

  Pipeline:

      guide.yaml
        -> Guide.load/1          validate + default-fill
        -> Expression.build/4    seed terms, transitive require closure, ordering
        -> Preamble.render/3     Loader/Layout body inside NPL@<version> markers
        -> Prompt.fields/1       PURPOSE / IDENTITY / SELF-IMAGE / ... fields
        -> Bundle                content-hashed dist/<slug>.bundle.json

  The output is a pure function of the guide document plus the vendored
  convention set: no timestamps, no uuids, no map-iteration order.
  """

  alias ToborKit.Compiler.Catalog
  alias ToborKit.Compiler.Error
  alias ToborKit.Compiler.Expression
  alias ToborKit.Compiler.Guide
  alias ToborKit.Compiler.Json
  alias ToborKit.Compiler.NPL.Definition
  alias ToborKit.Compiler.Preamble
  alias ToborKit.Compiler.Prompt

  @bundle_schema "tobor.guide-bundle"
  @bundle_version 1

  @doc """
  Compile the guide at `path`.

  Options:

    * `:conventions_dir` — override the vendored convention set.
    * `:strict` — treat unresolvable NPL terms as errors instead of warnings.
  """
  @spec compile_file(Path.t(), keyword()) :: {:ok, map()} | {:error, Error.t()}
  def compile_file(path, opts \\ []) do
    with {:ok, guide} <- Guide.load(path) do
      compile(guide, opts)
    end
  end

  @doc "Compile an already-validated (or raw) guide document."
  @spec compile(map(), keyword()) :: {:ok, map()} | {:error, Error.t()}
  def compile(guide, opts \\ []) do
    dir = Keyword.get(opts, :conventions_dir) || ToborKit.Compiler.Conventions.dir()

    with {:ok, guide} <- ensure_validated(guide),
         {:ok, defn} <- definition(dir),
         catalog = Catalog.new(dir, defn.section_order),
         {:ok, expr} <- expression(guide, catalog, defn, opts),
         {:ok, preamble} <- preamble(guide, defn, expr) do
      {:ok, bundle(guide, defn, expr, preamble)}
    end
  end

  @doc "Write a compiled bundle to `<out_dir>/<slug>.bundle.json`."
  @spec write(map(), Path.t()) :: {:ok, Path.t()} | {:error, Error.t()}
  def write(bundle, out_dir) do
    path = Path.join(out_dir, bundle_filename(bundle))

    with :ok <- File.mkdir_p(out_dir),
         :ok <- File.write(path, Json.pretty(bundle)) do
      {:ok, path}
    else
      {:error, reason} ->
        {:error, Error.new(:io, "Could not write #{path}: #{:file.format_error(reason)}")}
    end
  end

  @doc "`<slug>.bundle.json`."
  @spec bundle_filename(map()) :: String.t()
  def bundle_filename(bundle), do: "#{get_in(bundle, ["core", "slug"])}.bundle.json"

  # ---------------------------------------------------------------------------

  defp ensure_validated(%{"core" => _} = guide) do
    # `Guide.validate/1` is idempotent: defaults are already-satisfied no-ops.
    Guide.validate(guide)
  end

  defp ensure_validated(guide), do: Guide.validate(guide)

  defp definition(dir) do
    case Definition.new(dir) do
      {:ok, defn} -> {:ok, defn}
      {:error, reason} -> {:error, Error.new(:npl, reason)}
    end
  end

  defp expression(guide, catalog, defn, opts) do
    case Expression.build(guide, catalog, defn, opts) do
      {:ok, expr} ->
        {:ok, expr}

      {:error, warnings} ->
        {:error,
         Error.new(
           :npl,
           "NPL terms could not be resolved (--strict):",
           Enum.map(warnings, &%{path: "npl", message: &1})
         )}
    end
  end

  defp preamble(guide, defn, expr) do
    p = get_in(guide, ["npl", "preamble"]) || %{}

    Preamble.render(defn, expr,
      layout: Map.get(p, "layout", "yaml_order"),
      skip: Map.get(p, "skip", []),
      extension: Map.get(p, "extension", false),
      component_priority: Map.get(p, "component_priority", 0),
      example_priority: Map.get(p, "example_priority", 0)
    )
  end

  defp bundle(guide, defn, expr, preamble) do
    core = Map.get(guide, "core", %{})
    npl = Map.get(guide, "npl", %{})
    p = Map.get(npl, "preamble", %{})

    prompt_fields = Prompt.fields(guide)
    prompt = preamble <> "\n\n" <> Prompt.render(guide)

    body = %{
      "schema" => @bundle_schema,
      "version" => @bundle_version,
      "core" => %{
        "slug" => Map.get(core, "slug"),
        "name" => Map.get(core, "name"),
        "title" => Map.get(core, "title"),
        "archetype" => Map.get(core, "archetype"),
        "tags" => Map.get(core, "tags", []),
        "status" => Map.get(core, "status", "draft"),
        "organization" => Map.get(core, "organization"),
        "project" => Map.get(core, "project"),
        "model" => Map.get(core, "model")
      },
      "npl" => %{
        "framework_version" => defn.version,
        "declared_version" => Map.get(npl, "npl_version", "1.0"),
        "declaration_kind" => Map.get(npl, "declaration_kind", "agent"),
        "layout" => Map.get(p, "layout", "yaml_order"),
        "component_priority" => Map.get(p, "component_priority", 0),
        "example_priority" => Map.get(p, "example_priority", 0),
        "extension" => Map.get(p, "extension", false),
        "skip" => Map.get(p, "skip", []),
        "conventions_digest" => ToborKit.Compiler.Conventions.digest()
      },
      "expression" => expr.expression,
      "components" => Enum.map(expr.terms, &"#{&1.section}##{&1.slug}"),
      "seed_components" => Enum.map(expr.seeds, &"#{&1.section}##{&1.slug}"),
      "derived_components" => expr.derived,
      "preamble" => preamble,
      "prompt" => prompt,
      "prompt_fields" => prompt_fields,
      "warnings" => expr.warnings
    }

    Map.put(body, "bundle_hash", hash(body))
  end

  defp hash(body) do
    "sha256:" <> (:sha256 |> :crypto.hash(Json.compact(body)) |> Base.encode16(case: :lower))
  end
end

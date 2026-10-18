defmodule ToborKit.Compiler.Preamble do
  @moduledoc """
  Renders the frozen NPL syntax preamble for a closed expression.

  The default `yaml_order` layout goes through `Definition.format/2` — the
  canonical NPL renderer (ConventionFormatter): section bodies in the
  convention YAMLs' own order, greedy set-cover example selection, and native
  `component_priority` / `example_priority` filtering. It also emits the
  `⌜NPL@<version>⌝` framing, framework description, and core-concept glossary
  itself, so nothing is wrapped around its output.

  The `classic` / `grouped` layouts keep the Loader path (`Parser` ->
  `Resolver` -> `Layout`) because those ordering strategies only exist there;
  the framing and glossary are then added around the body here, and
  `example_priority` is baked onto terms as `:+N` (the Loader's only priority
  surface; `component_priority` has no Loader equivalent).

  Either way the guide's `npl.preamble.skip[]` terms are passed as
  satisfied-but-not-rendered: their `require:` edges stay closed (the closure
  in Expression already ran with them) but their bodies are omitted, and
  `npl.preamble.extension` swaps the framing to `⌜extend:NPL@<version>⌝`.
  """

  alias ToborKit.Compiler.Error
  alias ToborKit.Compiler.NPL.Definition
  alias ToborKit.Compiler.NPL.Loader

  @spec render(Definition.t(), map(), keyword()) :: {:ok, String.t()} | {:error, Error.t()}
  def render(%Definition{} = defn, %{expression: expression, terms: terms} = expr, opts) do
    layout = opts |> Keyword.get(:layout, "yaml_order") |> layout_atom()
    skip = Keyword.get(opts, :skip, [])
    extension = Keyword.get(opts, :extension, false)
    component_priority = Keyword.get(opts, :component_priority, 0)
    example_priority = Keyword.get(opts, :example_priority, 0)

    case layout do
      :yaml_order ->
        body =
          Definition.format(defn,
            components: component_specs(terms),
            rendered: rendered_specs(skip, expr),
            component_priority: component_priority,
            example_priority: example_priority,
            extension: extension
          )

        {:ok, body}

      strategy ->
        case Loader.load(with_default_priority(expression, example_priority),
               npl_dir: defn.conventions_dir,
               layout: strategy,
               skip: skip
             ) do
          {:ok, body} -> {:ok, wrap(defn, body, extension)}
          {:error, reason} -> {:error, render_error(reason)}
        end
    end
  end

  # The Definition renderer selects sections by component NAME.
  defp component_specs(terms) do
    terms
    |> Enum.group_by(& &1.section)
    |> Enum.sort_by(fn {section, _} -> section end)
    |> Enum.map(fn {section, ts} ->
      names = ts |> Enum.map(& &1.name) |> Enum.uniq() |> Enum.join(",")
      "#{section}:#{names}"
    end)
  end

  # `Definition.format/2` counts a rendered spec's deps as satisfied without
  # re-rendering the component — exactly `skip[]` semantics. Its spec grammar
  # is colon-form ("syntax:placeholder") with component names. Whole-section
  # skips and unknown slugs have no Definition-path equivalent and are ignored
  # here, matching Expression's closure treatment of them.
  defp rendered_specs(skip, expr) do
    skip_map = expr.skip_names || %{}

    Enum.flat_map(skip, fn term ->
      case Map.get(skip_map, term) do
        nil -> []
        name ->
          [section, _slug] = String.split(term, "#", parts: 2)
          ["#{section}:#{name}"]
      end
    end)
  end

  # The Loader path has no preamble-level priority knob; its `:+N` term
  # priority filters examples. Bake `example_priority` onto terms that do not
  # carry an explicit one.
  defp with_default_priority(expression, 0), do: expression

  defp with_default_priority(expression, ep) when is_integer(ep) and ep > 0 do
    expression
    |> String.split(~r/\s+/, trim: true)
    |> Enum.map_join(" ", fn
      term -> if String.contains?(term, ":") and not String.contains?(term, "::"), do: term, else: "#{term}:+#{ep}"
    end)
  end

  @spec layout_atom(String.t() | atom()) :: atom()
  def layout_atom("classic"), do: :classic
  def layout_atom("grouped"), do: :grouped
  def layout_atom("yaml_order"), do: :yaml_order
  def layout_atom(other) when is_atom(other), do: other
  def layout_atom(_), do: :yaml_order

  defp render_error(reason) do
    Error.new(:npl, "Could not render the NPL preamble:", [
      %{path: "npl", message: reason}
    ])
  end

  defp wrap(defn, body, extension) do
    {open, close} =
      if extension do
        {"⌜extend:NPL@#{defn.version}⌝", "⌞extend:NPL@#{defn.version}⌟"}
      else
        {"⌜NPL@#{defn.version}⌝", "⌞NPL@#{defn.version}⌟"}
      end

    IO.iodata_to_binary([
      open,
      "\n# Noizu Prompt Lingua (NPL)\n",
      defn.description,
      "\n\n## Core Concepts\n\n",
      concepts(defn),
      body,
      "\n",
      close
    ])
  end

  defp concepts(defn) do
    Enum.map_join(defn.concepts, "", fn concept ->
      name = Map.get(concept, "name", "")
      desc = concept |> Map.get("description", "") |> String.trim()
      "**#{name}**\n: #{desc}\n\n"
    end)
  end
end

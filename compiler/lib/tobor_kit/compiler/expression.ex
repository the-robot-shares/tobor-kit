defmodule ToborKit.Compiler.Expression do
  @moduledoc """
  Turns a guide's `npl:` block into a fully-closed NPL load expression.

  Three stages:

    1. **Seed** — the terms the guide asks for, directly or by implication
       (`declaration_kind`, `pumps[]`, `prompt_sections[]`, `syntax[]`, plus
       `special-sections#runtime-flags` / `#secure-prompt` when `flags` or
       `secure_block` are present).

    2. **Close** — the transitive `require:` closure. The Resolver deliberately
       does *not* expand `require:` (it copies the raw list at `resolver.ex:201`
       and the Layout prints it as a "*Requires:*" line), so the closure comes
       from the Definition dependency graph instead:
       `Definition.resolve_dependencies/3` -> `walk_dependencies/4`, a fixed-point
       loop that also propagates the max component/example priority.

    3. **Order** — the closed set is re-emitted in `npl.yaml` `section_order`,
       then in each section's YAML component order, so the expression (and
       therefore the rendered preamble) is byte-stable for a given input.
  """

  alias ToborKit.Compiler.Catalog
  alias ToborKit.Compiler.NPL.Definition
  alias ToborKit.Compiler.NPL.Parser

  @declaration_components %{
    "agent" => "agent-declaration",
    "persona" => "persona-agent-declaration",
    "tool" => "tool-agent-declaration",
    "service" => "service-agent-declaration"
  }

  @type term_ref :: %{section: String.t(), slug: String.t(), name: String.t(), priority: integer() | nil}

  @type result :: %{
          expression: String.t(),
          seeds: [term_ref()],
          terms: [term_ref()],
          derived: [String.t()],
          warnings: [String.t()]
        }

  @doc """
  Build the closed expression for `guide`.

  Returns `{:ok, result}`. Terms that name a nonexistent section or component
  are reported in `:warnings` and dropped; pass `strict: true` to turn those
  warnings into an error instead.
  """
  @spec build(map(), Catalog.t(), Definition.t(), keyword()) ::
          {:ok, result()} | {:error, [String.t()]}
  def build(guide, catalog, defn, opts \\ []) do
    npl = Map.get(guide, "npl", %{})
    preamble = Map.get(npl, "preamble", %{})

    {seeds, warnings} = seed_terms(npl, catalog)

    if opts[:strict] && warnings != [] do
      {:error, warnings}
    else
      {rendered_keys, skip_map} = rendered_keys(Map.get(preamble, "skip", []), catalog)
      closed = close(seeds, defn, rendered_keys)
      terms = order(closed, seeds, catalog)
      seed_keys = MapSet.new(seeds, &{&1.section, &1.name})

      {:ok,
       %{
         expression: Enum.map_join(terms, " ", &render_term/1),
         seeds: seeds,
         terms: terms,
         derived:
           terms
           |> Enum.reject(&MapSet.member?(seed_keys, {&1.section, &1.name}))
           |> Enum.map(&"#{&1.section}.#{&1.name}"),
         # Skipped terms as "section#slug" => component-name pairs. The
         # Definition renderer needs the name form to mark them
         # satisfied-but-not-rendered; see Preamble.
         skip_names: skip_map,
         warnings: warnings
       }}
    end
  end

  defp render_term(%{section: section, slug: slug, priority: nil}), do: "#{section}##{slug}"
  defp render_term(%{section: section, slug: slug, priority: p}), do: "#{section}##{slug}:+#{p}"

  # ---------------------------------------------------------------------------
  # Stage 1 — seeds
  # ---------------------------------------------------------------------------

  defp seed_terms(npl, catalog) do
    raw =
      List.flatten([
        declaration_term(npl),
        Enum.map(Map.get(npl, "pumps", []), &{"npl.pumps", "pumps##{&1}"}),
        Enum.map(Map.get(npl, "prompt_sections", []), &prompt_section_term/1),
        implied_special_sections(npl),
        Enum.map(Map.get(npl, "syntax", []), &{"npl.syntax", &1})
      ])

    {terms, warnings} =
      Enum.reduce(raw, {[], []}, fn {origin, term}, {acc, warns} ->
        case resolve_term(term, origin, catalog) do
          {:ok, ref} -> {[ref | acc], warns}
          {:warn, message} -> {acc, [message | warns]}
        end
      end)

    {dedupe(Enum.reverse(terms)), Enum.reverse(warnings)}
  end

  defp declaration_term(npl) do
    kind = Map.get(npl, "declaration_kind", "agent")
    component = Map.get(@declaration_components, kind, "agent-declaration")
    [{"npl.declaration_kind", "declarations##{component}"}]
  end

  # `prompt_sections` carries npl-prompt-section *type* values (example, format,
  # alg, ...). The convention component for a type is "<type>-prompt-section";
  # a type that is already a full component name is taken as-is.
  defp prompt_section_term(type) do
    {"npl.prompt_sections", "prompt-sections##{type}-prompt-section|prompt-sections##{type}"}
  end

  defp implied_special_sections(npl) do
    flags = if map_size(Map.get(npl, "flags", %{})) > 0, do: [{"npl.flags", "special-sections#runtime-flags"}], else: []

    secure =
      if is_binary(Map.get(npl, "secure_block")) and String.trim(Map.get(npl, "secure_block")) != "",
        do: [{"npl.secure_block", "special-sections#secure-prompt"}],
        else: []

    flags ++ secure
  end

  # A "a|b" term means: try `a`, fall back to `b`. Only `prompt_sections` uses it.
  defp resolve_term(term, origin, catalog) do
    results = term |> String.split("|") |> Enum.map(&resolve_one(&1, origin, catalog))

    case Enum.find(results, &match?({:ok, _}, &1)) do
      nil -> hd(results)
      ok -> ok
    end
  end

  defp resolve_one(term, origin, catalog) do
    case Parser.parse(term) do
      {:ok, %Parser.Expression{additions: [%Parser.Component{} = component]}} ->
        cond do
          is_nil(component.component) ->
            {:warn, "#{origin}: '#{term}' names a whole section; only section#component terms are accepted here"}

          name = Catalog.name_for_slug(catalog, component.section, component.component) ->
            {:ok,
             %{
               section: component.section,
               slug: component.component,
               name: name,
               priority: component.priority_max
             }}

          true ->
            {:warn,
             "#{origin}: component '#{component.component}' not found in section '#{component.section}'. Available: #{Catalog.available(catalog, component.section)}"}
        end

      {:ok, _} ->
        {:warn, "#{origin}: '#{term}' must be a single section#component term"}

      {:error, reason} ->
        {:warn, "#{origin}: #{reason}"}
    end
  end

  defp dedupe(terms) do
    terms
    |> Enum.reduce({[], %{}}, fn ref, {acc, seen} ->
      key = {ref.section, ref.name}

      case Map.fetch(seen, key) do
        {:ok, _} -> {acc, Map.update!(seen, key, &merge_priority(&1, ref.priority))}
        :error -> {[key | acc], Map.put(seen, key, ref)}
      end
    end)
    |> then(fn {keys, seen} -> keys |> Enum.reverse() |> Enum.map(&Map.fetch!(seen, &1)) end)
  end

  defp merge_priority(ref, nil), do: ref
  defp merge_priority(%{priority: nil} = ref, p), do: %{ref | priority: p}
  defp merge_priority(ref, p), do: %{ref | priority: max(ref.priority, p)}

  # ---------------------------------------------------------------------------
  # Stage 2 — transitive require closure
  # ---------------------------------------------------------------------------

  # `preamble.skip` names terms the consuming system already emitted. They are
  # passed to the closure as `rendered_keys` so their dependencies are not
  # dragged back in, and separately to the Loader as subtractions.
  defp rendered_keys(skip, catalog) do
    skip
    |> Enum.flat_map(fn term ->
      case Parser.parse(term) do
        {:ok, %Parser.Expression{additions: [%Parser.Component{component: slug, section: section}]}}
        when is_binary(slug) ->
          case Catalog.name_for_slug(catalog, section, slug) do
            nil -> []
            name -> [{term, "#{section}.#{name}", "#{section}##{slug}", name}]
          end

        _ ->
          []
      end
    end)
    |> then(fn rows ->
      keys = rows |> Enum.map(&elem(&1, 1)) |> MapSet.new()
      map = rows |> Enum.map(&{elem(&1, 2), elem(&1, 3)}) |> Map.new()
      {keys, map}
    end)
  end

  defp close(seeds, defn, rendered_keys) do
    conv_map =
      seeds
      |> Enum.group_by(& &1.section)
      |> Map.new(fn {section, refs} -> {section, {Enum.map(refs, & &1.name), 0, 0}} end)

    Definition.resolve_dependencies(defn, conv_map, rendered_keys)
  end

  # ---------------------------------------------------------------------------
  # Stage 3 — deterministic ordering
  # ---------------------------------------------------------------------------

  defp order(closed, seeds, catalog) do
    priorities = Map.new(seeds, &{{&1.section, &1.name}, &1.priority})

    closed
    |> Enum.flat_map(fn {section, {names, _cp, _ep}} ->
      names
      |> Enum.uniq()
      |> Enum.map(fn name ->
        %{
          section: section,
          name: name,
          slug: Catalog.slug_for_name(catalog, section, name) || name,
          priority: Map.get(priorities, {section, name})
        }
      end)
    end)
    |> Enum.sort_by(&{Catalog.section_position(catalog, &1.section), Catalog.position(catalog, &1.section, &1.name)})
  end
end

defmodule ToborKit.Compiler.Catalog do
  @moduledoc """
  A read-only index of the NPL convention set.

  The two prior-art code paths disagree about identity: the Resolver matches a
  component by its **slug** (`resolver.ex:154`), while the Definition dependency
  graph keys components by their **name** (`definition.ex:250`). Most conventions
  omit `slug:` entirely, in which case slug falls back to name — but the two are
  not interchangeable in general, so this module keeps both directions and every
  translation goes through it.
  """

  defstruct [:dir, :section_order, :sections]

  @type section :: %{
          order: [String.t()],
          slug_to_name: %{String.t() => String.t()},
          name_to_slug: %{String.t() => String.t()},
          index: %{String.t() => non_neg_integer()}
        }

  @type t :: %__MODULE__{
          dir: String.t(),
          section_order: [String.t()],
          sections: %{String.t() => section()}
        }

  @spec new(String.t(), [String.t()]) :: t()
  def new(dir, section_order) do
    sections =
      section_order
      |> Enum.map(&{&1, read_section(dir, &1)})
      |> Enum.reject(fn {_s, v} -> is_nil(v) end)
      |> Map.new()

    %__MODULE__{dir: dir, section_order: section_order, sections: sections}
  end

  @doc "All component names of a section, in YAML order."
  @spec names(t(), String.t()) :: [String.t()]
  def names(%__MODULE__{} = cat, section) do
    case Map.fetch(cat.sections, section) do
      {:ok, sec} -> sec.order
      :error -> []
    end
  end

  @doc "Translate a Resolver-style slug into a Definition-style name."
  @spec name_for_slug(t(), String.t(), String.t()) :: String.t() | nil
  def name_for_slug(%__MODULE__{} = cat, section, slug) do
    lookup(cat, section, :slug_to_name, slug)
  end

  @doc "Translate a Definition-style name into a Resolver-style slug."
  @spec slug_for_name(t(), String.t(), String.t()) :: String.t() | nil
  def slug_for_name(%__MODULE__{} = cat, section, name) do
    lookup(cat, section, :name_to_slug, name)
  end

  @doc "Position of a component within its section's YAML order (for stable sorting)."
  @spec position(t(), String.t(), String.t()) :: non_neg_integer()
  def position(%__MODULE__{} = cat, section, name) do
    lookup(cat, section, :index, name) || 0
  end

  @doc "Position of a section within npl.yaml's `section_order` (for stable sorting)."
  @spec section_position(t(), String.t()) :: non_neg_integer()
  def section_position(%__MODULE__{} = cat, section) do
    case Enum.find_index(cat.section_order, &(&1 == section)) do
      nil -> length(cat.section_order)
      i -> i
    end
  end

  @doc "Known slugs for a section, joined — used to make \"not found\" errors actionable."
  @spec available(t(), String.t()) :: String.t()
  def available(%__MODULE__{} = cat, section) do
    case Map.fetch(cat.sections, section) do
      {:ok, sec} -> sec.order |> Enum.map(&Map.fetch!(sec.name_to_slug, &1)) |> Enum.join(", ")
      :error -> ""
    end
  end

  defp lookup(%__MODULE__{} = cat, section, field, key) do
    case Map.fetch(cat.sections, section) do
      {:ok, sec} -> Map.get(Map.fetch!(sec, field), key)
      :error -> nil
    end
  end

  defp read_section(dir, section) do
    path = Path.join(dir, "#{section}.yaml")

    with true <- File.exists?(path),
         {:ok, data} <- YamlElixir.read_from_file(path) do
      components = Map.get(data, "components", [])

      pairs =
        Enum.map(components, fn c ->
          name = Map.get(c, "name", "")
          {name, Map.get(c, "slug") || name}
        end)

      %{
        order: Enum.map(pairs, &elem(&1, 0)),
        slug_to_name: Map.new(pairs, fn {name, slug} -> {slug, name} end),
        name_to_slug: Map.new(pairs),
        index: pairs |> Enum.with_index() |> Map.new(fn {{name, _}, i} -> {name, i} end)
      }
    else
      _ -> nil
    end
  end
end

defmodule ToborKit.Hologram.Support.Theme do
  @moduledoc """
  Theming bridge: projects the guide-projection's free-form `ui.theme`
  string-keyed map into an inline `style` attribute string.

  This replaces the Lit runtime `applyThemeVars(host, theme)` helper
  (`web/src/components/mode-toggle/theme.ts`), which sets CSS custom
  properties on the host element. Hologram has no host element — hosts
  interpolate the returned string into the root element's `style` attr
  in `init/3` instead:

      def init(_params, component, _server) do
        style = Theme.apply_theme_vars(theme_from_guide(component))
        put_state(component, theme_style: style)
      end

      # template
      <div class="tk tk-my-thing" style={@theme_style}>...</div>

  Keys: `some_key` becomes `--tobor-kit-some-key` (underscore to dash).
  Keys already starting with `--` pass through verbatim. Values are trimmed;
  entries whose value contains `;` or a newline are dropped (style-attr
  injection guard).
  """

  @spec apply_theme_vars(%{optional(String.t()) => String.t()}, %{optional(String.t()) => String.t()}) ::
          String.t()
  def apply_theme_vars(theme, defaults \\ %{})

  def apply_theme_vars(theme, defaults) when is_map(theme) and is_map(defaults) do
    Map.merge(defaults, theme)
    |> Enum.sort_by(fn {key, _} -> key end)
    |> Enum.flat_map(fn
      {key, value} when is_binary(key) and is_binary(value) ->
        value = String.trim(value)

        if safe?(value) do
          ["#{var_name(key)}: #{value};"]
        else
          []
        end

      _invalid ->
        []
    end)
    |> Enum.join(" ")
  end

  def apply_theme_vars(_theme, _defaults), do: ""

  defp safe?(value), do: not (String.contains?(value, ";") or String.contains?(value, "\n"))

  defp var_name("--" <> _ = key), do: key
  defp var_name(key), do: "--tobor-kit-" <> String.replace(key, "_", "-")
end

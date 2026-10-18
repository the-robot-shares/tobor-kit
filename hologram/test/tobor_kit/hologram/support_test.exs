defmodule ToborKit.Hologram.SupportTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Events
  alias ToborKit.Hologram.Support.Theme

  describe "Classes.classes/2" do
    test "merges parts, dropping nil/false/empty" do
      assert Classes.classes("tk tk-mode-toggle", [nil, "", false, "is-on"]) ==
               "tk tk-mode-toggle is-on"
    end

    test "base-only" do
      assert Classes.classes("tk", []) == "tk"
    end

    test "non-list extras" do
      assert Classes.classes("tk", "extra") == "tk extra"
      assert Classes.classes("tk", nil) == "tk"
    end
  end

  describe "Theme.apply_theme_vars/2" do
    test "underscore keys become --tobor-kit-* kebab vars" do
      assert Theme.apply_theme_vars(%{"accent_color" => "#ff0000"}) ==
               "--tobor-kit-accent-color: #ff0000;"
    end

    test "keys already starting with -- pass through verbatim" do
      assert Theme.apply_theme_vars(%{"--brand-x" => "1px"}) == "--brand-x: 1px;"
    end

    test "empty map" do
      assert Theme.apply_theme_vars(%{}) == ""
    end

    test "nil/invalid map" do
      assert Theme.apply_theme_vars(nil) == ""
    end

    test "defaults are overridden by theme entries" do
      result =
        Theme.apply_theme_vars(%{"accent" => "#0f0"}, %{
          "accent" => "#00ff00",
          "border" => "#333"
        })

      assert result == "--tobor-kit-accent: #0f0; --tobor-kit-border: #333;"
    end

    test "values are trimmed and unsafe values dropped (style-attr injection guard)" do
      result =
        Theme.apply_theme_vars(%{
          "accent" => "  red  ",
          "bad" => "red; background: url(x)",
          "newline" => "red\nscript"
        })

      assert result == "--tobor-kit-accent: red;"
    end

    test "non-string values are dropped" do
      assert Theme.apply_theme_vars(%{"accent" => 12}) == ""
    end
  end

  describe "Events contract" do
    test "registry event names are kept verbatim" do
      assert %{"persona" => ["persona-select"]} = Events.all()
      assert Events.all()["phone-input"] == ["country-change", "phone-change", "phone-invalid"]
    end
  end
end

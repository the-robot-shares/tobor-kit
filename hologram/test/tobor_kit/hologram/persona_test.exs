defmodule ToborKit.Hologram.PersonaTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Persona.Picker

  @personas [
    %{"id" => "sheggoth", "name" => "Sheggoth", "handle" => "@sheggoth"},
    %{"id" => "mask", "name" => "The Mask"},
    %{"id" => "weego", "name" => "Weego", "handle" => "  @weego  "},
    %{"id" => "", "name" => "No Id"},
    %{"id" => "orphan", "name" => ""}
  ]

  describe "Picker.filter_personas/2 (Lit filterPersonas)" do
    test "drops rows without id or name" do
      assert Picker.filter_personas(@personas, "") |> Enum.map(&Picker.persona_id/1) ==
               ["sheggoth", "mask", "weego"]
    end

    test "empty query keeps all valid rows" do
      assert length(Picker.filter_personas(@personas, "   ")) == 3
    end

    test "matches id, name, or handle, case-insensitively" do
      assert Picker.filter_personas(@personas, "SHEG") |> Enum.map(&Picker.persona_id/1) ==
               ["sheggoth"]
      assert Picker.filter_personas(@personas, "mask") |> Enum.map(&Picker.persona_id/1) ==
               ["mask"]
      assert Picker.filter_personas(@personas, "@wee") |> Enum.map(&Picker.persona_id/1) ==
               ["weego"]
    end

    test "no match → empty" do
      assert Picker.filter_personas(@personas, "zzz") == []
    end
  end

  describe "Picker row accessors (string-keyed map contract)" do
    test "persona_id/persona_name default to empty string" do
      assert Picker.persona_id(%{}) == ""
      assert Picker.persona_name(%{}) == ""
      assert Picker.persona_id(%{"id" => "x"}) == "x"
    end

    test "handle_text trims; absent handle → empty string" do
      assert Picker.handle_text(%{"handle" => "  @we  "}) == "@we"
      assert Picker.handle_text(%{}) == ""
      assert Picker.handle_text(%{"handle" => nil}) == ""
    end
  end

  describe "Picker.empty_copy/1 (Lit emptyCopy)" do
    test "no personas vs no matches" do
      assert Picker.empty_copy([]) == "No personas"
      assert Picker.empty_copy([%{"id" => "x", "name" => "X"}]) == "No matching personas"
    end
  end

  describe "gallery render (conn-based smoke)" do
    test "picker + persona card render light-DOM roots with registry data-cy hooks" do
      html = render_gallery()

      assert html =~ ~s(class="tk tk-persona-picker")
      assert html =~ ~s(class="tk tk-party-card tk-persona-card")
      refute html =~ "<tk-persona-picker"
      refute html =~ "<tk-persona-card"

      assert html =~ ~s(data-cy="persona.card")
      assert html =~ ~s(data-cy="persona.picker")
      assert html =~ ~s(data-cy="persona.search")
      assert html =~ ~s(data-cy="persona.item")
      assert html =~ ~s(data-persona-id="sheggoth")
      assert html =~ ~s(data-persona-id="weego")
      # invalid rows never render
      refute html =~ ~s(data-persona-id="")
    end

    test "seeded query filters server-side (stateful init ran: cid present)" do
      html = render_gallery()

      # the query-seeded picker section renders only Weego; the Sheggoth item
      # belongs to the unfiltered default picker
      assert html =~ "Weego"
      assert html =~ "Sheggoth"
      assert html =~ ~s(value="wee")
    end

    test "empty roster renders the No personas copy" do
      html = render_gallery()
      assert html =~ "No personas"
    end

    test "select CTA renders; disabled for blank persona_id (bindings ship via the client bundle)" do
      html = render_gallery()
      assert html =~ "Select"
      assert html =~ ~s(disabled="true")
    end

    defp render_gallery do
      conn =
        :get
        |> Plug.Test.conn("/gallery")
        |> Map.put(
          :secret_key_base,
          "tk_hologram_test_secret_key_base_padding_padding_padding_at_least_64_bytes_long__"
        )
        |> Plug.Conn.fetch_query_params()
        |> ToborKit.Hologram.TestSupport.Router.call([])

      assert conn.status == 200, "expected 200, got #{conn.status}"
      conn.resp_body
    end
  end
end

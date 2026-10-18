defmodule ToborKit.Hologram.FaqTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.Faq.Faq

  # — logic —

  test "mode clamp" do
    assert Faq.clamp_mode("one") == "one"
    assert Faq.clamp_mode("many") == "many"
    assert Faq.clamp_mode("bogus") == "many"
  end

  test "items_view normalizes string/atom maps with positional indices" do
    view =
      Faq.items_view([
        %{"question" => "Q1", "answer" => "A1"},
        %{question: "Q2", answer: "A2"},
        nil
      ])

    assert view == [
             %{index: 0, question: "Q1", answer: "A1"},
             %{index: 1, question: "Q2", answer: "A2"},
             %{index: 2, question: "", answer: ""}
           ]

    assert Faq.items_view(nil) == []
  end

  test "toggle opens, closes, and enforces the accordion in one-mode" do
    component = init_faq(mode: "many")

    result = Faq.action(:toggle, %{index: 0}, component)
    assert result.state.open == [0]
    assert result.next_action.name == :faq_toggle
    assert result.next_action.params == %{open: true, index: 0}

    result = Faq.action(:toggle, %{index: 1}, result)
    assert Enum.sort(result.state.open) == [0, 1]

    result = Faq.action(:toggle, %{index: 0}, result)
    assert result.state.open == [1]
    assert result.next_action.params == %{open: false, index: 0}
  end

  test "one-mode accordion closes the others" do
    component = init_faq(mode: "one")

    result = Faq.action(:toggle, %{index: 0}, component)
    assert result.state.open == [0]

    result = Faq.action(:toggle, %{index: 1}, result)
    assert result.state.open == [1]
  end

  defp init_faq(overrides) do
    props =
      Map.merge(
        %{
          items: [
            %{"question" => "Q1", "answer" => "A1"},
            %{"question" => "Q2", "answer" => "A2"}
          ],
          mode: "many",
          target: "parent",
          class: ""
        },
        Map.new(overrides)
      )

    Faq.init(props, %Hologram.Component{}, %Hologram.Server{})
  end

  # — rendered HTML —

  @moduletag :render

  test "gallery renders native details/summary with registry data-cy hooks" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-faq")
    assert html =~ ~s(data-cy="faq.list")
    assert html =~ ~s(data-cy="faq.item")
    assert html =~ ~s(data-cy="faq.trigger")
    assert html =~ "What is tobor-kit?"
    assert html =~ "An agent-guide component kit."
    # Lit disclosure classes are preserved
    assert html =~ ~s(class="hui disclosure disclosure-panel tk-faq__item")
    assert html =~ ~s(class="hui disclosure-button tk-faq__trigger")
    # FAQ items start closed — no `open` on the FAQ's own details
    # (other gallery families, e.g. npl-view, start their details open)
    refute Regex.match?(~r/<details[^>]*tk-faq__item[^>]*\sopen/, html)
  end

  test "gallery renders the slotted fallback mode when items are empty" do
    html = render_gallery()

    # second faq embed has no items → <slot /> display-only mode
    assert html =~ ~s(<details>
        <summary>Slotted question</summary>)
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

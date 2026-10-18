defmodule ToborKit.Hologram.ModeToggleTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.ModeToggle.Toggle

  # — logic —

  test "mode labels cover known guide modes, unknown pass through" do
    assert Toggle.mode_label("voice") == "Voice"
    assert Toggle.mode_label("text") == "Text"
    assert Toggle.mode_label("transcript") == "Transcript"
    assert Toggle.mode_label("custom") == "custom"
  end

  test "checked? flag" do
    assert Toggle.checked?("text", "text") == "true"
    assert Toggle.checked?("voice", "text") == "false"
  end

  test "modes_value keeps strings, drops the rest" do
    assert Toggle.modes_value(["voice", 42, "text"]) == ["voice", "text"]
    assert Toggle.modes_value(nil) == []
  end

  test "select action updates state and queues the host notification" do
    component = init_component(modes: ["voice", "text"], mode: "text", target: "page")

    result = Toggle.action(:select, %{mode: "voice"}, component)

    assert result.state.mode == "voice"
    assert %Hologram.Component.Action{} = action = result.next_action
    assert action.name == :tobor_mode_change
    assert action.params == %{mode: "voice", previous: "text"}
    assert action.target == "page"
  end

  test "select action is a no-op when disabled or already active" do
    component = init_component(mode: "text", disabled: true)
    assert Toggle.action(:select, %{mode: "voice"}, component).next_action == nil

    component = init_component(mode: "text")
    assert Toggle.action(:select, %{mode: "text"}, component).next_action == nil
  end

  defp init_component(overrides) do
    props =
      Map.merge(
        %{
          modes: ["voice", "text"],
          mode: "text",
          disabled: false,
          target: "parent",
          class: ""
        },
        Map.new(overrides)
      )

    Toggle.init(props, %Hologram.Component{}, %Hologram.Server{})
  end

  # — rendered HTML —

  @moduletag :render

  test "gallery renders the mode toggle with radiogroup semantics" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-mode-toggle")
    assert html =~ ~s(role="radiogroup" aria-label="Conversation mode")
    assert html =~ ~s(role="radio" data-mode="voice" aria-checked="false")
    # active mode is checked AND disabled (Lit ?disabled expression)
    assert html =~ ~s(role="radio" data-mode="text" aria-checked="true" disabled="true")
    assert html =~ ~s(data-mode="transcript")
    assert html =~ "Voice"
    assert html =~ "Transcript"
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

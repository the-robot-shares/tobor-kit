defmodule ToborKit.Hologram.RobotAvatarTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.RobotAvatar.Avatar

  # — logic —

  test "state clamp to the seven canonical guide states" do
    for state <- Avatar.guide_states() do
      assert Avatar.resolved_state(state) == state
    end

    assert Avatar.resolved_state("dancing") == "idle"
    assert Avatar.resolved_state(nil) == "idle"
  end

  test "motion policy: force_static/ignore, respect defaults to animated" do
    assert Avatar.motion_policy("force_static") == "static"
    assert Avatar.motion_policy("ignore") == "animated"
    assert Avatar.motion_policy("respect") == "animated"
    assert Avatar.motion_policy(nil) == "animated"
  end

  test "unknown_state echoes the raw input only when invalid" do
    assert Avatar.unknown_state("idle") == nil
    assert Avatar.unknown_state("dancing") == "dancing"
  end

  test "fallback marks non-glyph renderers without a sanitized source" do
    assert Avatar.fallback("sprite", nil) == "glyph"
    assert Avatar.fallback("lottie", nil) == "glyph"
    assert Avatar.fallback("sprite", "/a.png") == nil
    assert Avatar.fallback("glyph", nil) == nil
  end

  test "source sanitization blocks script URLs and non-image data: URLs" do
    assert Avatar.sanitized_source(%{"src" => "javascript:alert(1)"}) == nil
    assert Avatar.sanitized_source(%{"src" => "vbscript:x"}) == nil
    assert Avatar.sanitized_source(%{"src" => "data:text/html;base64,xxx"}) == nil
    assert Avatar.sanitized_source(%{"src" => "data:image/png;base64,xxx"}) != nil
    assert Avatar.sanitized_source(%{"src" => "JAVASCRIPT:alert(1)"}) == nil
    # style-attr injection guards
    assert Avatar.sanitized_source(%{"src" => "/a b.png"}) == nil
    assert Avatar.sanitized_source(%{"src" => "/a(b).png"}) == nil
    assert Avatar.sanitized_source(%{"src" => "/robot.png"}) == "/robot.png"
    assert Avatar.sanitized_source(nil) == nil
  end

  test "sprite_for prefers the per-state asset over default" do
    avatar = %{
      "states" => %{"thinking" => %{"src" => "/thinking.png"}},
      "default" => %{"src" => "/default.png"}
    }

    assert Avatar.sprite_for(avatar, "thinking") == %{"src" => "/thinking.png"}
    assert Avatar.sprite_for(avatar, "idle") == %{"src" => "/default.png"}
    assert Avatar.sprite_for(nil, "idle") == nil
  end

  test "speed_for inverts the per-state speed hint" do
    assert Avatar.speed_for(%{"thinking" => %{"speed" => 2}}, "thinking") == "0.5"
    assert Avatar.speed_for(%{"thinking" => %{"speed" => 0}}, "thinking") == "1"
    assert Avatar.speed_for(%{}, "thinking") == "1"
  end

  test "sprite_style projects columns/rows/position" do
    style =
      Avatar.sprite_style(
        %{"columns" => 2, "rows" => 1, "column" => 1, "row" => 0},
        "/robot.png"
      )

    assert style =~ ~s|background-image:url("/robot.png")|
    assert style =~ "background-size:200% 100%"
    assert style =~ "background-position:100.0% 50.0%"
    assert Avatar.sprite_style(nil, nil) == ""
  end

  test "antenna lights for listening/thinking/tool_running" do
    assert Avatar.antenna_class("listening") == "lit"
    assert Avatar.antenna_class("thinking") == "lit"
    assert Avatar.antenna_class("tool_running") == "lit"
    assert Avatar.antenna_class("idle") == "shell"
  end

  # — rendered HTML —

  @moduletag :render

  test "gallery renders glyph states with data-state hooks" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-robot-avatar" data-state="idle")
    assert html =~ ~s(data-state="thinking")
    assert html =~ ~s(data-state="error")
    assert html =~ ~s(role="img" aria-label="Guide: idle")
    # unknown state clamps + is echoed on data-unknown-state
    assert html =~
             ~s(data-state="idle" data-motion="static" data-renderer="glyph" data-unknown-state="dancing")
    # eyes tell states apart
    assert html =~ ~s(data-eyes="up")
    assert html =~ ~s(data-eyes="error")
    assert html =~ ~s(data-eyes="normal")
    # mouth + badge
    assert html =~ ~s(data-mouth="smile")
    assert html =~ ~s(data-mouth="gear")
    # sr-only state label
    assert html =~ ~s(<span class="tk-robot-avatar__sr-only sr-only">thinking</span>)
  end

  test "gallery renders sprite mode and the sanitization fallback" do
    html = render_gallery()

    assert html =~ ~s|background-image:url(&quot;https://cdn.example.com/robot.png&quot;)|
    # unsafe src is dropped: glyph fallback + renderer-fallback hook
    assert html =~ ~s(data-renderer="sprite" data-renderer-fallback="glyph")
    refute html =~ "javascript:"
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

defmodule ToborKit.Hologram.NoizuSgTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.Sg.Btn
  alias ToborKit.Hologram.Sg.Card
  alias ToborKit.Hologram.Sg.CardGrid
  alias ToborKit.Hologram.Sg.Input
  alias ToborKit.Hologram.Sg.SpecTable
  alias ToborKit.Hologram.Sg.Status
  alias ToborKit.Hologram.Sg.Steps

  # — logic —

  test "btn clamps variant/size/type" do
    assert Btn.resolved_variant("danger") == "danger"
    assert Btn.resolved_variant("bogus") == "primary"
    assert Btn.resolved_size("sm") == "sm"
    assert Btn.resolved_size("xl") == "md"
    assert Btn.resolved_type("submit") == "submit"
    assert Btn.resolved_type("reset") == "button"
  end

  test "card href guard trims whitespace" do
    assert Card.has_href(" https://x.example ")
    refute Card.has_href("   ")
    refute Card.has_href("")
  end

  test "card grid columns clamp" do
    assert CardGrid.resolved_columns(5) == 5
    assert CardGrid.resolved_columns(0) == 3
    assert CardGrid.resolved_columns(-2) == 3
  end

  test "status clamp" do
    assert Status.resolved_status("ok") == "ok"
    assert Status.resolved_status("error") == "error"
    assert Status.resolved_status("whatever") == "idle"
  end

  test "input type clamp + flag helpers" do
    assert Input.resolved_type("textarea") == "textarea"
    assert Input.resolved_type("tel") == "tel"
    assert Input.resolved_type("color") == "text"
    assert Input.error_flag(true) == "true"
    assert Input.error_flag(false) == "false"
    assert Input.maybe_name("") == nil
    assert Input.maybe_name("email") == "email"
  end

  test "spec table rows normalize string/atom maps and bare items" do
    view =
      SpecTable.rows_view([
        %{"key" => "K", "value" => "V"},
        %{key: :a, value: 42},
        "bare",
        nil
      ])

    assert view == [
             %{key: "K", value: "V"},
             %{key: "a", value: "42"},
             %{key: "", value: "bare"},
             %{key: "", value: ""}
           ]
  end

  test "steps view assigns done/current/todo states" do
    view = Steps.steps_view(["a", "b", "c"], 1)

    assert Enum.map(view, &Map.get(&1, :state)) == ["done", "current", "todo"]
    assert Enum.map(view, &Map.get(&1, :aria_current)) == ["false", "step", "false"]
    assert Enum.map(view, &Map.get(&1, :number)) == ["1", "2", "3"]
  end

  test "steps current clamp" do
    assert Steps.resolved_current(7) == 7
    assert Steps.resolved_current("x") == 0
  end

  # — rendered HTML (served gallery page) —

  @moduletag :render

  test "gallery renders the styleguide mirrors with registry data-cy hooks" do
    html = render_gallery()

    # btn
    assert html =~ ~s(class="tk tk-sg-btn")
    assert html =~ ~s(data-cy="sg.btn")
    assert html =~ ~s(data-variant="danger")
    assert html =~ ~s(data-size="lg")
    assert html =~ ~s(type="submit" disabled="true")
    # invalid variant clamps to primary — "bogus" is never echoed
    refute html =~ ~s(data-variant="bogus")

    # card: link form + plain article form
    assert html =~ ~s(data-cy="sg.card")
    assert html =~ ~s(href="https://example.com/card")
    assert html =~ ~s(<article class="tk-sg-card__card")

    # grid
    assert html =~ ~s(data-cy="sg.grid")
    assert html =~ ~s(data-columns="2")
    assert html =~ ~s(style="--sg-columns: 2")

    # status
    assert html =~ ~s(data-cy="sg.status")
    assert html =~ ~s(data-status="ok")
    assert html =~ ~s(role="status")
    refute html =~ ~s(data-status="bogus")

    # input: input form with error flag + textarea form
    assert html =~ ~s(data-cy="sg.input")
    assert html =~ ~s(type="email" name="email" aria-invalid="true")
    assert html =~ ~s(<textarea class="tk-sg-input__field")

    # spec table: registry hook + text-only escaped cells
    assert html =~ ~s(data-cy="sg.spec")
    assert html =~ ~s(&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;)
    refute html =~ "<b>bold</b>"

    # steps
    assert html =~ ~s(data-cy="sg.steps")
    assert html =~ ~s(data-current="1")
    assert html =~ ~s(data-state="current" aria-current="step")
    assert html =~ ~s(data-state="done")
    assert html =~ ~s(data-state="todo")
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

defmodule ToborKit.Hologram.GalleryRenderTest do
  use ExUnit.Case, async: false

  @moduletag :render

  # Conn-based render smoke test: serve the test-scope gallery fixture page
  # through Hologram.Router and assert the mirror DOM contract shows up in
  # the served HTML (`.tk` root + registry-style data-cy hook).
  test "GET /gallery renders the placeholder mirror with .tk root and data-cy hooks" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-placeholder")
    assert html =~ ~s(data-cy="gallery.placeholder")
    assert html =~ ~s(data-cy="gallery.placeholder.item.alpha")
    refute html =~ "<tk-placeholder"
  end

  test "GET /gallery renders the transpiler-spike component" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-spike")
    assert html =~ ~s(data-cy="spike.input")
  end

  # -- wave 4: composed content views ------------------------------------

  test "GET /gallery renders the transcript-view states" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-transcript-view")
    assert html =~ "Hello guide"
    assert html =~ ~s(data-testid="turn-tools")
    assert html =~ ~s(data-testid="pending-turn")
    assert html =~ ~s(data-testid="transcript-empty")
    assert html =~ "Nothing said yet."
    assert html =~ ~s(data-testid="not-server-backed")
    assert html =~ "the server stores no copy"
    assert html =~ ~s(data-testid="transcript-clear")
  end

  test "GET /gallery renders the chat-thread with roster, composer, and message mapping" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-chat-thread")
    assert html =~ ~s(data-cy="thread.root")
    assert html =~ ~s(data-cy="thread.composer")
    assert html =~ ~s(data-cy="thread.send")
    # messages alias mapped onto turns: stamp + participant prefixed as text
    assert html =~ "2026-09-15 10:30 UTC · Keith"
    assert html =~ "Keith"
    # markup in messages stays escaped characters
    assert html =~ "&lt;b&gt;not&lt;/b&gt; html"
  end

  test "GET /gallery renders every asset-view mime branch plus the editor" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-asset-view")
    assert html =~ ~s(data-cy="asset.view")
    assert html =~ ~s(data-kind="image")
    assert html =~ ~s(data-kind="text")
    assert html =~ ~s(data-kind="other")
    assert html =~ "No asset"
    assert html =~ ~s(data-cy="asset.editor")
    assert html =~ ~s(data-cy="asset.save")
    # text body is escaped characters
    assert html =~ "keep\nthis text"
  end

  test "GET /gallery renders the artifact view/editor pair" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-artifact-view")
    assert html =~ ~s(data-cy="artifact.view")
    assert html =~ ~s(data-cy="artifact.review")
    assert html =~ "Release notes"
    assert html =~ "No artifact."
    assert html =~ ~s(data-cy="artifact.editor")
    assert html =~ ~s(data-cy="artifact.save")
  end

  test "GET /gallery renders the wiki space/entry/editor trio" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-wiki-space")
    assert html =~ ~s(data-cy="wiki.space")
    assert html =~ ~s(data-cy="wiki.space-item")
    assert html =~ ~s(data-cy="wiki.entry")
    assert html =~ "&lt;section&gt;stays source&lt;/section&gt;"
    assert html =~ ~s(data-cy="wiki.editor")
    assert html =~ ~s(data-cy="wiki.save")
    assert html =~ "No entry."
  end

  test "GET /gallery renders the review panel with rows and composer" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-review-panel")
    assert html =~ ~s(data-cy="review.panel")
    assert html =~ ~s(data-cy="review.item")
    assert html =~ ~s(data-cy="review.composer")
    assert html =~ ~s(data-cy="review.submit")
    assert html =~ "2026-09-15 10:30 UTC"
    assert html =~ ~s(data-status="open")
    assert html =~ ~s(data-status="resolved")
    assert html =~ "No reviews yet"
  end

  test "GET /gallery renders the mcp-config form" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-mcp-config")
    assert html =~ ~s(data-cy="mcp.config")
    assert html =~ ~s(data-cy="mcp.save")
    assert html =~ "https://mcp.example.test/mcp"
    # invalid transport clamped to http at mount
    assert html =~ ~s(value="http")
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

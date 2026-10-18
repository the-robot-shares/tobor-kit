defmodule ToborKit.Hologram.FooterBrandTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.FooterBrand.Brand

  # — logic —

  test "clamps theme/palette/align to documented presets" do
    assert Brand.theme("light") == "light"
    assert Brand.theme("auto") == "auto"
    assert Brand.theme("dark") == "dark"
    assert Brand.theme("banana") == "dark"
    assert Brand.theme("") == "dark"

    assert Brand.palette("mono") == "mono"
    assert Brand.palette("accent") == "accent"
    assert Brand.palette("nope") == "default"

    assert Brand.align("start") == "start"
    assert Brand.align("end") == "end"
    assert Brand.align("nope") == "center"
  end

  test "target/rel attributes follow the _blank rule" do
    assert Brand.target_attr("") == nil
    assert Brand.target_attr("_top") == "_top"
    assert Brand.target_attr("help") == "help"
    assert Brand.target_attr(nil) == nil

    assert Brand.rel_attr("_blank") == "noopener noreferrer"
    assert Brand.rel_attr("_self") == nil
    assert Brand.rel_attr("") == nil
  end

  test "line pieces suppress empty prefix/suffix with their spacing" do
    assert Brand.line_prefix("A") == "A "
    assert Brand.line_prefix("Built by") == "Built by "
    assert Brand.line_prefix("") == ""
    assert Brand.line_prefix(nil) == ""

    assert Brand.line_suffix("Joint") == " Joint"
    assert Brand.line_suffix("Labs") == " Labs"
    assert Brand.line_suffix("") == ""
    assert Brand.line_suffix(nil) == ""
  end

  # — rendered HTML —

  @moduletag :render

  test "gallery renders the footer-brand mirrors with registry data-cy hooks" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-footer-brand")
    assert html =~ ~s(data-cy="footer-brand-root")
    assert html =~ ~s(data-cy="footer-brand-link")
    assert html =~ "The Robot Lives"
    assert html =~ ~s(href="https://derobot.is")

    # customized variant: clamped data attrs + host-provided pieces
    assert html =~ ~s(data-theme="light")
    assert html =~ ~s(data-palette="accent")
    assert html =~ "Built by"
    assert html =~ "Labs"
    assert html =~ ~s(href="https://noizu.com")
    assert html =~ ~s(rel="noopener noreferrer")

    # align clamp surfaces on the root
    assert html =~ ~s(data-align="start")
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

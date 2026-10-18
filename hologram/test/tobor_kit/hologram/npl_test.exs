defmodule ToborKit.Hologram.NplTest do
  use ExUnit.Case, async: false

  @moduletag :render

  alias ToborKit.Hologram.Npl.Tokenizer

  # Render smoke tests share the gallery page fixture (conn-based); tokenizer
  # logic unit tests live in npl/tokenizer_test.exs.
  test "GET /gallery renders the npl-view mirror with .tk root and data-cy hooks" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-npl-view")
    assert html =~ ~s(data-cy="npl.view")
    assert html =~ ~s(data-cy="npl.copy")
    assert html =~ ~s(data-cy="npl.fold")
    # highlighted token class from the sample source
    assert html =~ "npl-declaration"
    assert html =~ "npl-placeholder"
  end

  test "GET /gallery renders the empty-source variant" do
    html = render_gallery()

    assert html =~ "No source."
  end

  test "sample source round-trips through the tokenizer" do
    source = Tokenizer.sample_source()
    assert source |> Tokenizer.tokenize() |> Enum.map(& &1.text) |> Enum.join("") == source
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

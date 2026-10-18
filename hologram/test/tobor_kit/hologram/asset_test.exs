defmodule ToborKit.Hologram.AssetTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Asset.Assets

  doctest ToborKit.Hologram.Asset.Assets

  describe "mime_kind/1" do
    test "classifies essential mime types, ignoring parameters and case" do
      assert Assets.mime_kind("image/png") == :image
      assert Assets.mime_kind("IMAGE/JPEG; charset=binary") == :image
      assert Assets.mime_kind("text/plain") == :text
      assert Assets.mime_kind("text/html; charset=utf-8") == :text
      assert Assets.mime_kind("application/octet-stream") == :other
      assert Assets.mime_kind("") == :other
      assert Assets.mime_kind(nil) == :other
    end
  end

  describe "essential_mime/1" do
    test "strips parameters, trims, downcases" do
      assert Assets.essential_mime(" Text/Plain ;q=1") == "text/plain"
    end
  end

  describe "text_body/1" do
    test "reads string bodies, defaults missing ones to empty" do
      assert Assets.text_body(%{"body" => "hi"}) == "hi"
      assert Assets.text_body(%{body: "hi"}) == "hi"
      assert Assets.text_body(%{}) == ""
      assert Assets.text_body(nil) == ""
      assert Assets.text_body(%{"body" => 42}) == ""
    end
  end

  describe "preview_src/1" do
    test "passes through safe srcs and trims" do
      assert Assets.preview_src(" https://example.test/a.png ") == "https://example.test/a.png"
    end

    test "rejects javascript: URLs case-insensitively" do
      assert Assets.preview_src("javascript:alert(1)") == nil
      assert Assets.preview_src("JavaScript:alert(1)") == nil
      assert Assets.preview_src("JAVASCRIPT:x") == nil
    end

    test "rejects blank/non-string srcs" do
      assert Assets.preview_src("   ") == nil
      assert Assets.preview_src(nil) == nil
    end
  end
end

defmodule ToborKit.Hologram.Asset.ViewTest do
  use ExUnit.Case, async: true

  # The stateless view's helpers — exercised through the gallery render test
  # for markup; here we cover the mime branching predicates indirectly.
  alias ToborKit.Hologram.Asset.View

  test "mime branch predicates" do
    assert View.image_mime?("image/png")
    assert View.text_mime?("text/plain")
    refute View.image_mime?("text/plain")
  end

  test "download label" do
    assert View.download_label(%{"name" => "logo.png"}) == "Download logo.png"
  end
end

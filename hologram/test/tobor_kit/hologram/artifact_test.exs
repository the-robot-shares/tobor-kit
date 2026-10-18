defmodule ToborKit.Hologram.ArtifactTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Artifact.View

  @artifact %{id: "demo", title: "Release notes", version: 1, body: "body", mime: "text/plain"}

  test "dual-key accessors" do
    assert View.artifact_title(%{"title" => "T"}) == "T"
    assert View.artifact_title(@artifact) == "Release notes"
    assert View.artifact_body(nil) == ""
  end

  test "version label renders string and numeric versions" do
    assert View.version_label(1) == "1"
    assert View.version_label("2") == "2"
    assert View.version_label(nil) == ""
  end

  test "no_id? guards the review affordance" do
    refute View.no_id?(@artifact)
    assert View.no_id?(%{})
    assert View.no_id?(nil)
  end
end

defmodule ToborKit.Hologram.Support.HttpTest do
  # Req resolves localhost connections through the OS — the failure-path
  # cases below bind nothing, so async is safe.
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Support.Http

  @closed_url "http://127.0.0.1:1/nope"

  describe "post/3" do
    test "returns {:error, %{reason}} on transport failure" do
      assert {:error, %{reason: reason}} = Http.post(@closed_url, %{"ping" => 1})
      assert is_binary(reason)
    end
  end

  describe "get/2" do
    test "returns {:error, %{reason}} on transport failure" do
      assert {:error, %{reason: reason}} = Http.get(@closed_url)
      assert is_binary(reason)
    end

    test "accepts query params without changing the outcome shape" do
      assert {:error, %{reason: reason}} = Http.get(@closed_url, params: %{"q" => "x"})
      assert is_binary(reason)
    end
  end
end

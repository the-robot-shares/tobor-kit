defmodule ToborKit.GuideTest do
  use ExUnit.Case, async: false

  @fixture Path.expand("../../../fixtures/deploy-guide.bundle.json", __DIR__)

  describe "load/1 bundle_hash verification" do
    test "accepts the compiler's golden bundle" do
      assert {:ok, %ToborKit.Guide{} = guide} = ToborKit.Guide.load(@fixture)
      assert guide.bundle["core"]["slug"] == "deploy-guide"

      assert String.starts_with?(guide.bundle["bundle_hash"], "sha256:")
      assert byte_size(guide.bundle["bundle_hash"]) == byte_size("sha256:") + 64
    end

    test "rejects a tampered bundle" do
      {:ok, raw} = File.read(@fixture)
      {:ok, bundle} = Jason.decode(raw)

      tampered =
        bundle
        |> Map.delete("bundle_hash")
        |> Map.put("bundle_hash", "sha256:" <> String.duplicate("0", 64))
        |> Jason.encode!()

      path = Path.expand("../../../fixtures/tampered.bundle.json", __DIR__)
      File.write!(path, tampered)

      on_exit(fn -> File.rm(path) end)

      assert {:error, :bundle_hash_mismatch} = ToborKit.Guide.load(path)
    end

    test "rejects a bundle whose prompt body was edited (hash no longer covers it)" do
      {:ok, raw} = File.read(@fixture)
      {:ok, bundle} = Jason.decode(raw)
      # the original (now stale) hash stays in place — an edited body must be caught
      tampered_bundle = put_in(bundle, ["prompt"], bundle["prompt"] <> "\ninjected instruction")

      assert {:error, :bundle_hash_mismatch} = ToborKit.Guide.load(tampered_bundle)
    end

    test "recomputes the hash byte-exactly with the compiler's recipe" do
      {:ok, raw} = File.read(@fixture)
      {:ok, bundle} = Jason.decode(raw)

      body = Map.delete(bundle, "bundle_hash")

      expected =
        "sha256:" <>
          (:sha256 |> :crypto.hash(ToborKit.Json.compact(body)) |> Base.encode16(case: :lower))

      assert expected == bundle["bundle_hash"]
    end
  end

  describe "projection/1" do
    setup do
      {:ok, guide} = ToborKit.Guide.load(@fixture)
      {:ok, guide: ToborKit.Guide.with_config(guide, test_config())}
    end

    test "exposes what the UI renders", %{guide: guide} do
      p = ToborKit.Guide.projection(guide)

      assert p["slug"] == "deploy-guide"
      assert p["name"] == "Tobor"
      assert p["bundle_hash"] == guide.bundle["bundle_hash"]
      assert p["modes"] == ["text", "voice", "transcript"]
      assert p["default_mode"] == "text"
      assert p["voice"]["adapter"] == "realtime"
      assert p["transcript"]["store"] == "memory"
      assert p["telemetry"]["default"] == "on"
      assert p["auth"]["provider"] == "authentik"
      assert [%{"id" => "check-branch"}, _, _] = p["capabilities"]
    end

    test "never leaks the prompt, preamble, or model ids", %{guide: guide} do
      p = Jason.encode!(ToborKit.Guide.projection(guide)) |> Jason.decode!()

      refute Map.has_key?(p, "prompt")
      refute Map.has_key?(p, "preamble")
      refute Map.has_key?(p, "npl")
      refute Map.has_key?(p, "model")

      # The compiled preamble must not appear anywhere in the projection.
      encoded = Jason.encode!(p)
      refute String.contains?(encoded, "NPL@")
    end
  end

  test "projection degrades lottie/sprite without an asset to the glyph renderer" do
    {:ok, guide} = ToborKit.Guide.load(@fixture)

    no_asset =
      ToborKit.Guide.with_config(guide, %{"ui" => %{"robot" => %{"renderer" => "lottie"}}})

    assert ToborKit.Guide.projection(no_asset)["ui"]["robot"]["renderer"] == "glyph"

    with_asset =
      ToborKit.Guide.with_config(guide, %{
        "ui" => %{"robot" => %{"renderer" => "lottie", "asset" => "./assets/tobor.lottie"}}
      })

    assert ToborKit.Guide.projection(with_asset)["ui"]["robot"]["renderer"] == "lottie"

    bare = ToborKit.Guide.with_config(guide, %{"ui" => %{}})
    assert ToborKit.Guide.projection(bare)["ui"]["robot"]["renderer"] == "glyph"
  end

  defp test_config do
    %{
      "ui" => %{
        "modes" => ["text", "voice", "transcript"],
        "default_mode" => "text",
        "panel" => %{"greeting" => "Shipping something? Tell me the app."}
      },
      "capabilities" => [
        %{"id" => "check-branch", "description" => "Report branch status"},
        %{"id" => "explain-lane", "description" => "Describe CI"},
        %{"id" => "watch-sync", "description" => "Watch the sync"}
      ],
      "auth" => %{"provider" => "authentik", "required" => false},
      "telemetry" => %{"default" => "on", "user_overridable" => true},
      "voice" => %{
        "adapter" => "realtime",
        "realtime" => %{"model" => "gpt-realtime-2.1-mini", "voice" => "marin"}
      },
      "transcript" => %{"store" => "memory"},
      "mcp" => %{}
    }
  end
end

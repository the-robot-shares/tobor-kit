defmodule ToborKit.VoiceTest do
  use ExUnit.Case, async: false

  @realtime_cfg %{
    "adapter" => "realtime",
    "realtime" => %{"model" => "gpt-realtime-2.1-mini", "voice" => "marin"}
  }

  defp guide(voice_cfg) do
    {:ok, guide} = ToborKit.Guide.load(fixture_path())
    ToborKit.Guide.with_config(guide, %{"voice" => voice_cfg})
  end

  defp fixture_path, do: Path.expand("../../../fixtures/deploy-guide.bundle.json", __DIR__)

  test "native adapter: minting is refused (contract 409)" do
    assert {:error, :no_credential_needed} = ToborKit.Voice.mint(guide(%{"adapter" => "native"}))
  end

  test "none adapter: voice unavailable (contract 503)" do
    assert {:error, :unavailable} = ToborKit.Voice.mint(guide(%{"adapter" => "none"}))
  end

  test "realtime adapter without a key is dark (contract 503)" do
    Application.delete_env(:tobor_kit, ToborKit.Voice.Realtime)
    System.delete_env("OPENAI_API_KEY")

    assert {:error, :unavailable} = ToborKit.Voice.mint(guide(@realtime_cfg))
  end

  test "realtime adapter mints an ephemeral secret without leaking the long-lived key" do
    System.delete_env("OPENAI_API_KEY")

    Application.put_env(:tobor_kit, ToborKit.Voice.Realtime,
      api_key: "sk-live-key-never-on-the-wire-to-clients"
    )

    parent = self()

    Application.put_env(:tobor_kit, :realtime_http, fn {:post_json, url, body, headers} ->
      send(parent, {:http, url, body, headers})

      {:ok,
       %{
         status: 200,
         body: Jason.encode!(%{"value" => "ek_ephemeral_secret", "expires_at" => 1_700_000_000})
       }}
    end)

    on_exit(fn ->
      Application.delete_env(:tobor_kit, :realtime_http)
      Application.delete_env(:tobor_kit, ToborKit.Voice.Realtime)
    end)

    {:ok, credential} = ToborKit.Voice.mint(guide(@realtime_cfg))

    assert credential["adapter"] == "realtime"

    # Minted exact, no skew padding: ISO8601 the client can parse and trust.
    assert {:ok, %DateTime{}, _} = DateTime.from_iso8601(credential["expires_at"])

    assert credential["realtime"]["token"] == "ek_ephemeral_secret"
    assert credential["realtime"]["model"] == "gpt-realtime-2.1-mini"
    assert credential["realtime"]["voice"] == "marin"

    receive do
      {:http, url, body, headers} ->
        assert url == "https://api.openai.com/v1/realtime/client_secrets"
        assert {"authorization", "Bearer sk-live-key-never-on-the-wire-to-clients"} in headers
        session = Jason.decode!(body)["session"]
        assert session["model"] == "gpt-realtime-2.1-mini"
        assert get_in(session, ["audio", "output", "voice"]) == "marin"
    after
      100 -> flunk("no mint request was made")
    end

    # The credential shape carries no long-lived key.
    refute inspect(credential) =~ "sk-live-key"
  end

  test "realtime adapter surfaces provider errors (contract 503)" do
    System.delete_env("OPENAI_API_KEY")
    Application.put_env(:tobor_kit, ToborKit.Voice.Realtime, api_key: "sk-live")

    Application.put_env(:tobor_kit, :realtime_http, fn {:post_json, _url, _body, _headers} ->
      {:ok, %{status: 401, body: "{}"}}
    end)

    on_exit(fn ->
      Application.delete_env(:tobor_kit, :realtime_http)
      Application.delete_env(:tobor_kit, ToborKit.Voice.Realtime)
    end)

    assert {:error, {:provider_error, 401, "{}"}} = ToborKit.Voice.mint(guide(@realtime_cfg))
  end
end

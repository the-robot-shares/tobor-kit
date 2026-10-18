defmodule ToborKit.Hologram.GuidePanelTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.GuidePanel.Panel

  @guide %{
    "slug" => "demo",
    "name" => "Demo Guide",
    "title" => "The demo",
    "greeting" => "Hello there",
    "modes" => ["voice", "text", "transcript"],
    "default_mode" => "text",
    "ui" => %{
      "panel" => %{"start_expanded" => true, "show_tool_list" => false},
      "robot" => %{"renderer" => "sprite"}
    }
  }

  defmodule Stub401Config do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:tobor_kit_api), do: %{base_url: "https://stub-401.test", token: "t0k"}
    def resolve(_scope), do: %{}
  end

  defmodule StubHostConfig do
    @behaviour ToborKit.Hologram.HostConfig

    @impl true
    def resolve(:tobor_kit_api), do: %{base_url: "https://stub-guide.test", token: "t0k"}
    def resolve(_scope), do: %{}
  end

  setup do
    Application.put_env(:tobor_kit_hologram, :host_config_module, StubHostConfig)

    on_exit(fn ->
      Application.delete_env(:tobor_kit_hologram, :host_config_module)
      Application.delete_env(:tobor_kit_hologram, :http_module)
    end)

    :ok
  end


  describe "state machine (canonical GuideState 7 values)" do
    test "clamp_state/1 clamps to the canonical set" do
      for s <- ~w(idle listening thinking speaking tool_running error offline) do
        assert Panel.clamp_state(s) == s
      end

      assert Panel.clamp_state("dancing") == "idle"
      assert Panel.clamp_state(nil) == "idle"
    end
  end

  describe "projection helpers (string-keyed access)" do
    test "guide_loaded? requires a non-empty named projection" do
      refute Panel.guide_loaded?(%{})
      refute Panel.guide_loaded?(%{"slug" => "x"})
      assert Panel.guide_loaded?(@guide)
    end

    test "default_mode: explicit default wins, else first mode, else text" do
      assert Panel.default_mode(@guide) == "text"
      assert Panel.default_mode(%{"modes" => ["transcript", "text"]}) == "transcript"
      assert Panel.default_mode(%{}) == "text"
    end

    test "guide_modes filters to known spellings" do
      assert Panel.guide_modes(@guide) == ["voice", "text", "transcript"]
      assert Panel.guide_modes(%{"modes" => ["telepathy", "text"]}) == ["text"]
      assert Panel.guide_modes(%{}) == []
    end

    test "panel flags default to shown; explicit false hides" do
      assert Panel.show_task_menu?(@guide)
      refute Panel.show_tool_list?(@guide)
      assert Panel.show_task_menu?(%{})
    end

    test "panel_start_expanded: projection wins over prop" do
      assert Panel.panel_start_expanded(@guide, false) == true
      assert Panel.panel_start_expanded(%{}, true) == true
      assert Panel.panel_start_expanded(%{}, false) == false
    end

    test "placement clamp" do
      assert Panel.clamp_placement("docked") == "docked"
      assert Panel.clamp_placement("wobbly") == "floating"
    end
  end

  describe "turn response consumption (one-shot §6.9)" do
    test "plain JSON turn passes through normalized" do
      assert {:ok, turn} = Panel.consume_turn_response(%{"id" => "t1", "content" => "hi"})
      assert turn.role == "assistant"
      assert turn.tool_calls == []
    end

    test "SSE body: terminal message frame is the turn" do
      assert {:ok, turn} = Panel.consume_turn_response(ToborKit.Hologram.TestSupport.HttpStub.sse_message())
      assert turn.content == "Stub turn content"
    end

    test "SSE body: terminal error frame → error" do
      assert {:error, %{code: "turn_failed"}} = Panel.consume_turn_response(ToborKit.Hologram.TestSupport.HttpStub.sse_error())
    end

    test "SSE body without a terminal frame → stream_incomplete (client.ts parity)" do
      assert {:error, %{code: "stream_incomplete"}} =
               Panel.consume_turn_response(ToborKit.Hologram.TestSupport.HttpStub.sse_incomplete())
    end
  end

  describe "normalize_turn/1 + normalize_inventory/1 + errors" do
    test "turn defaults fill" do
      turn = Panel.normalize_turn(%{"id" => "t9", "content" => "x"})
      assert turn.role == "assistant"
      assert turn.created_at == ""
      assert Panel.normalize_turn(nil).content == ""
    end

    test "inventory normalization to groups/tools/degraded" do
      inv = Panel.normalize_inventory(%{"tools" => [%{"name" => "a"}]})
      assert inv["groups"] == []
      assert length(inv["tools"]) == 1
      assert Panel.normalize_inventory(nil) == Panel.empty_inventory()
    end

    test "error normalization accepts maps and strings" do
      assert Panel.normalize_error("boom", "turn_failed") == %{code: "turn_failed", message: "boom"}
      assert Panel.normalize_error(%{"code" => "x", "message" => "m"}, "t") == %{code: "x", message: "m"}
      assert Panel.normalize_error(%{message: "m"}, "t") == %{code: "t", message: "m"}
    end
  end

  describe "init/3" do
    test "guide prop seeds state; no bootstrap action" do
      component = Panel.init(%{guide: @guide}, %Hologram.Component{}, %Hologram.Server{})

      assert component.state.guide == @guide
      assert component.state.expanded == true
      assert component.state.mode == "text"
      assert component.next_action == nil
    end

    test "no guide + auto_fetch chains :bootstrap" do
      component = Panel.init(%{auto_fetch: true}, %Hologram.Component{}, %Hologram.Server{})

      assert %{next_action: %{name: :bootstrap}} = component
    end

    test "no guide without auto_fetch stays in the loading state" do
      component = Panel.init(%{}, %Hologram.Component{}, %Hologram.Server{})

      assert component.next_action == nil
      assert component.state.guide == %{}
    end
  end

  describe "commands (stubbed HTTP seam)" do
    test ":fetch_guide → :guide_loaded with the projection" do
      Application.put_env(:tobor_kit_hologram, :http_module, ToborKit.Hologram.TestSupport.HttpStub)

      server = Panel.command(:fetch_guide, %{}, %Hologram.Server{})

      assert %{next_action: %{name: :guide_loaded}} = server
      assert server.next_action.params.guide["name"] == "Stub Guide"
    end

    test ":fetch_guide 401 → :guide_error" do
      Application.put_env(:tobor_kit_hologram, :http_module, ToborKit.Hologram.TestSupport.HttpStub)
      Application.put_env(:tobor_kit_hologram, :host_config_module, Stub401Config)

      server = Panel.command(:fetch_guide, %{}, %Hologram.Server{})

      assert %{next_action: %{name: :guide_error}} = server
      assert server.next_action.params.error.code == "http_401"
    end

    test ":fetch_guide with unconfigured HostConfig → :guide_error (config, not crash)" do
      Application.delete_env(:tobor_kit_hologram, :host_config_module)

      server = Panel.command(:fetch_guide, %{}, %Hologram.Server{})

      assert %{next_action: %{name: :guide_error}} = server
      assert server.next_action.params.error.code == "config"
    end

    test ":submit_turn creates a session, consumes the SSE turn, returns :turn_completed" do
      Application.put_env(:tobor_kit_hologram, :http_module, ToborKit.Hologram.TestSupport.HttpStub)

      server =
        Panel.command(
          :submit_turn,
          %{input: "hello", task_id: nil, session_id: nil},
          %Hologram.Server{}
        )

      assert %{next_action: %{name: :turn_completed}} = server
      assert server.next_action.params.session_id == "sess-1"
      assert server.next_action.params.turn.content == "Stub turn content"
    end

    test ":submit_turn with an existing session id skips creation" do
      Application.put_env(:tobor_kit_hologram, :http_module, ToborKit.Hologram.TestSupport.HttpStub)

      server =
        Panel.command(
          :submit_turn,
          %{input: "hello", task_id: "Github.PullCreate", session_id: "kept"},
          %Hologram.Server{}
        )

      assert %{next_action: %{name: :turn_completed}} = server
      assert server.next_action.params.session_id == "kept"
    end

    test ":submit_turn reserved key raises through the HostConfig guard" do
      assert_raise ArgumentError, ~r/reserved secret key/, fn ->
        Panel.command(:submit_turn, %{input: "x", token: "spoof"}, %Hologram.Server{})
      end
    end
  end

  describe "gallery render (conn-based smoke)" do
    test "guide panel renders the composed surface with the Lit testid contract" do
      html = render_gallery()

      assert html =~ ~s(class="tk tk-guide-panel tk-guide-panel--inline")
      assert html =~ "Gallery Guide"
      assert html =~ ~s(data-testid="greeting")
      assert html =~ ~s(data-testid="text-input")
      assert html =~ ~s(data-testid="send")
      assert html =~ ~s(data-testid="collapse")
      assert html =~ ~s(data-testid="voice-unavailable")
      # loading state (no guide prop, no auto_fetch)
      assert html =~ ~s(data-testid="panel-loading")
      assert html =~ "Loading guide…"
    end
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

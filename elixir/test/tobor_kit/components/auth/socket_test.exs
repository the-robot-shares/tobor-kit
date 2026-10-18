defmodule ToborKit.Auth.SocketTest do
  use ExUnit.Case, async: true
  alias ToborKit.Auth.{Socket, SocketPlug}
  import Plug.Conn
  import Plug.Test

  defmodule Handler do
    def handle_auth("config", %{"email" => email} = params, context) do
      send(self(), {:config_context, email, context.browser_binding})

      {:ok,
       %{
         providers: [%{id: "authentik", href: Map.get(params, "href", "/auth/authentik/start")}],
         domain_policies: %{"noizu.com" => %{providers: ["authentik"]}},
         methods: []
       }}
    end

    def handle_auth("config", _, _), do: {:ok, %{providers: [%{id: "oidc", href: "/auth/oidc"}]}}
    def handle_auth("login", %{"password" => "throw"}, _), do: raise("sensitive exception")
    def handle_auth("login", %{"password" => "token"}, _), do: {:ok, %{access_token: "sensitive"}}

    def handle_auth("login", %{"echo_binding" => true}, context),
      do: {:ok, %{browser_binding: context.browser_binding}}

    def handle_auth("login", %{"assert_binding" => expected}, context) do
      if context.browser_binding == expected,
        do: {:ok, %{redirect: "/finish"}},
        else: {:error, "binding", "Missing binding"}
    end

    def handle_auth("login", %{"redirect" => redirect}, _), do: {:ok, %{redirect: redirect}}
    def handle_auth("login", %{"nested" => nested}, _), do: {:ok, %{user: nested}}
    def handle_auth("login", _, _), do: {:ok, %{redirect: "/auth/session/finish?code=once"}}

    def handle_auth("register", params, _) do
      send(self(), {:register_params, params})
      {:ok, %{redirect: "/auth/session/finish?code=once"}}
    end
  end

  defp state,
    do: %{handler: Handler, context: %{browser_binding: "browser-nonce-0123456789"}, count: 0}

  defp state(invite_token) when invite_token in [:optional, :required, :ignore],
    do: Map.put(state(), :invite_token, invite_token)

  defp request(method, params \\ %{}),
    do: Jason.encode!(%{version: 1, id: "one", method: method, params: params})

  defp reply(data), do: reply(data, state())

  defp reply(data, state) do
    {:push, {:text, json}, state} = Socket.handle_in({data, opcode: :text}, state)
    {Jason.decode!(json), state}
  end

  test "accepts exact origin and explicitly configured dev origin only" do
    base = conn(:get, "https://example.com/auth/socket")
    assert SocketPlug.allowed_origin?(put_req_header(base, "origin", "https://example.com"), [])
    refute SocketPlug.allowed_origin?(base, [])

    for origin <- [
          "null",
          "https://evil.com",
          "http://example.com",
          "https://example.com:444",
          "https://example.com/path",
          "https://user@example.com"
        ] do
      refute SocketPlug.allowed_origin?(put_req_header(base, "origin", origin), [])
    end

    assert SocketPlug.allowed_origin?(
             put_req_header(
               conn(:get, "http://localhost:4000/auth/socket"),
               "origin",
               "http://localhost:5173"
             ),
             development: true,
             allowed_origins: ["http://localhost:5173"]
           )
  end

  test "nonmatching paths pass through; forbidden origins fail before upgrade" do
    opts = SocketPlug.init(handler: Handler)
    refute SocketPlug.call(conn(:get, "/elsewhere"), opts).halted
    assert SocketPlug.call(conn(:get, "/auth/socket"), opts).status == 403
  end

  test "config and handoff responses are correlated; credentials not retained" do
    assert {%{"id" => "one", "result" => %{"providers" => [_]}}, _} = reply(request("config"))

    assert {%{"result" => %{"redirect" => _}}, %{count: 1} = result_state} =
             reply(request("login", %{password: "private"}))

    refute inspect(result_state) =~ "private"
  end

  test "email discovery passes email and trusted binding to host and preserves authoritative policy" do
    assert {%{
              "result" => %{
                "providers" => [%{"id" => "authentik", "href" => "/auth/authentik/start"}],
                "domain_policies" => %{"noizu.com" => %{"providers" => ["authentik"]}},
                "methods" => []
              }
            }, _} =
             reply(request("config", %{email: "person@noizu.com", browser_binding: "untrusted"}))

    assert_received {:config_context, "person@noizu.com", "browser-nonce-0123456789"}
  end

  test "provider discovery rejects external OAuth and SAML start URLs" do
    for href <- [
          "https://provider.example/start",
          "//provider.example/start",
          "/\\evil.test/start"
        ] do
      assert {%{"error" => %{"code" => "invalid_response"}}, _} =
               reply(request("config", %{email: "person@noizu.com", href: href}))
    end
  end

  test "malformed input, unknown methods, exceptions and credential responses fail closed" do
    for data <- [
          "not json",
          request("unknown"),
          request("login", %{password: "throw"}),
          request("login", %{password: "token"})
        ] do
      assert {%{"error" => %{"message" => message}}, _} = reply(data)
      refute message =~ "sensitive"
    end
  end

  test "limits binary frames, oversized messages and requests per connection" do
    assert {:stop, :normal, 1009, _} = Socket.handle_in({"x", opcode: :binary}, state())

    assert {:stop, :normal, 1009, _} =
             Socket.handle_in({String.duplicate("x", 16_385), opcode: :text}, state())

    assert {:stop, :normal, 1008, _} =
             Socket.handle_in({request("config"), opcode: :text}, %{state() | count: 60})
  end

  test "invalid envelope boundaries never invoke authentication" do
    valid = %{version: 1, id: "one", method: "login", params: %{}}

    for invalid <- [
          %{version: 2},
          %{id: ""},
          %{id: 1},
          %{id: String.duplicate("x", 129)},
          %{params: []},
          %{method: "__info__"}
        ] do
      assert {%{"error" => %{"code" => "invalid_request"}}, _} =
               reply(Jason.encode!(Map.merge(valid, invalid)))
    end
  end

  test "rejects nested secrets and unsafe handoff URLs" do
    assert {%{"error" => _}, _} = reply(request("login", %{nested: [%{refresh_token: "secret"}]}))

    for path <- [
          "https://evil.com",
          "//evil.com",
          "/\\evil.com",
          "/\n/evil.com",
          "javascript:alert(1)"
        ] do
      assert {%{"error" => _}, _} = reply(request("login", %{redirect: path}))
    end

    assert {%{"result" => _}, _} =
             reply(request("login", %{redirect: "/auth/finish?code=single-use"}))
  end

  test "matching auth path only accepts GET" do
    assert SocketPlug.call(conn(:post, "/auth/socket"), SocketPlug.init(handler: Handler)).status ==
             405
  end

  test "valid origin upgrades using Bandit's WebSock tuple" do
    conn =
      conn(:get, "https://example.com/auth/socket")
      |> put_req_header("origin", "https://example.com")

    upgraded =
      conn
      |> put_private(:tobor_auth_context, %{browser_binding: "browser-nonce-0123456789"})
      |> SocketPlug.call(SocketPlug.init(handler: Handler))

    assert upgraded.state == :upgraded
    assert upgraded.halted
  end

  test "development origin exception cannot change host or scheme" do
    base = conn(:get, "https://example.com/auth/socket")

    for origin <- ["https://evil.com", "http://example.com:5173"] do
      refute SocketPlug.allowed_origin?(put_req_header(base, "origin", origin),
               development: true,
               allowed_origins: [origin]
             )
    end

    refute SocketPlug.allowed_origin?(put_req_header(base, "origin", "https://example.com:5173"),
             allowed_origins: ["https://example.com:5173"]
           )
  end

  test "missing or malformed browser context fails closed before upgrade" do
    base =
      conn(:get, "https://example.com/auth/socket")
      |> put_req_header("origin", "https://example.com")

    for context <- [
          nil,
          %{},
          %{browser_binding: "short"},
          %{browser_binding: 1},
          %{browser_binding: String.duplicate("x", 257)},
          %{browser_binding: "browser-nonce-0123456789", cookie: "private"}
        ] do
      assert base
             |> put_private(:tobor_auth_context, context)
             |> SocketPlug.call(SocketPlug.init(handler: Handler))
             |> Map.get(:status) == 403
    end
  end

  test "handler receives browser binding but cannot return it" do
    assert {%{"result" => _}, _} =
             reply(request("login", %{assert_binding: "browser-nonce-0123456789"}))

    assert {%{"error" => _}, _} = reply(request("login", %{echo_binding: true}))
  end

  test "invite_token policy defaults to optional passthrough (state without the key)" do
    params = %{"user" => %{"email" => "p@x.test"}, "invite_token" => "tok"}
    assert {%{"result" => %{"redirect" => _}}, _} = reply(request("register", params))

    assert_received {:register_params, %{"invite_token" => "tok"}}
  end

  test "invite_token policy :required rejects a missing or blank token before the handler" do
    for params <- [
          %{"user" => %{"email" => "p@x.test"}},
          %{"user" => %{"email" => "p@x.test"}, "invite_token" => "   "}
        ] do
      assert {%{"error" => %{"code" => "invalid_invite_token"}}, _} =
               reply(request("register", params), state(:required))
    end

    refute_received {:register_params, _}

    assert {%{"result" => %{"redirect" => _}}, _} =
             reply(
               request("register", %{
                 "user" => %{"email" => "p@x.test"},
                 "invite_token" => "tok"
               }),
               state(:required)
             )

    assert_received {:register_params, %{"invite_token" => "tok"}}
  end

  test "invite_token policy :ignore strips the param from top level and user" do
    assert {%{"result" => %{"redirect" => _}}, _} =
             reply(
               request("register", %{
                 "user" => %{"email" => "p@x.test", "invite_token" => "nested"},
                 "invite_token" => "top"
               }),
               state(:ignore)
             )

    assert_received {:register_params, params}
    refute Map.has_key?(params, "invite_token")
    refute Map.has_key?(params["user"], "invite_token")
  end

  test "invite_token policy :ignore passes user-less payloads through unshaped" do
    assert {%{"result" => %{"redirect" => _}}, _} =
             reply(request("register", %{"invite_token" => "top"}), state(:ignore))

    assert_received {:register_params, params}
    assert params == %{}
  end

  test "invite_token policy only gates register and unknown modes clamp to optional" do
    # Other methods pass through under every policy.
    assert {%{"result" => _}, _} = reply(request("login", %{password: "private"}), state(:required))

    assert SocketPlug.init(handler: Handler, invite_token: :bogus)[:invite_token] == :optional
    assert SocketPlug.init(handler: Handler, invite_token: :ignore)[:invite_token] == :ignore
    assert SocketPlug.init(handler: Handler)[:invite_token] == :optional
  end
end

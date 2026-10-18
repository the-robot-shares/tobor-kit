defmodule ToborKit.Hologram.PartyCardTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.PartyCard.AgentCard
  alias ToborKit.Hologram.PartyCard.Card
  alias ToborKit.Hologram.PartyCard.UserCard

  describe "Card.initials/1 (Lit initials getter)" do
    test "first two parts, upcased" do
      assert Card.initials("Ada Lovelace") == "AL"
      assert Card.initials("madame bovary extra words") == "MB"
    end

    test "single part" do
      assert Card.initials("tobor") == "T"
    end

    test "blank → ?" do
      assert Card.initials("") == "?"
      assert Card.initials("   ") == "?"
    end

    test "collapses runs of spaces (regex-free split divergence)" do
      assert Card.initials("Ada  Lovelace") == "AL"
    end
  end

  describe "Card.resolved_presence/1 (Lit willUpdate clamp)" do
    test "valid presences pass through" do
      for presence <- Card.presences() do
        assert Card.resolved_presence(presence) == presence
      end
    end

    test "invalid/missing clamps to offline" do
      assert Card.resolved_presence("nonsense") == "offline"
      assert Card.resolved_presence(nil) == "offline"
      assert Card.resolved_presence("") == "offline"
    end
  end

  describe "Card.presence_label/1 (Lit PRESENCE_LABEL)" do
    test "labels per registry presence values" do
      assert Card.presence_label("online") == "Online"
      assert Card.presence_label("away") == "Away"
      assert Card.presence_label("offline") == "Offline"
      assert Card.presence_label("hidden") == "Hidden"
    end

    test "unknown falls back to Offline" do
      assert Card.presence_label("nonsense") == "Offline"
    end
  end

  describe "AgentCard.capability_chips/1 (Lit renderBelow trim+filter)" do
    test "trims and drops blanks" do
      assert AgentCard.capability_chips([" search ", "", "summarize", "  "]) ==
               ["search", "summarize"]
    end

    test "empty list stays empty" do
      assert AgentCard.capability_chips([]) == []
    end
  end

  describe "UserCard badges (Lit renderExtraBadges)" do
    test "role/org badges: trimmed, or nil when blank" do
      assert UserCard.role_badge(" foreman ") == "foreman"
      assert UserCard.role_badge("") == nil
      assert UserCard.role_badge("   ") == nil
      assert UserCard.org_badge("noizu") == "noizu"
      assert UserCard.org_badge("") == nil
    end
  end

  describe "gallery render (conn-based smoke)" do
    test "party-card mirrors render light-DOM roots with registry data-cy hooks" do
      html = render_gallery()

      # roots: no custom elements, .tk + family class
      assert html =~ ~s(class="tk tk-party-card")
      assert html =~ ~s(class="tk tk-party-card tk-agent-card")
      assert html =~ ~s(class="tk tk-party-card tk-user-card")
      refute html =~ "<tk-party-card"
      refute html =~ "<tk-agent-card"
      refute html =~ "<tk-user-card"

      # party.card identity hooks (registry cy, verbatim)
      assert html =~ ~s(data-cy="party.card")
      assert html =~ ~s(data-cy="party.name")
      assert html =~ ~s(data-cy="party.handle")
      assert html =~ ~s(data-cy="party.presence")

      # subclass hooks
      assert html =~ ~s(data-cy="agent.card")
      assert html =~ ~s(data-cy="agent.chat")
      assert html =~ ~s(data-cy="agent.caps")
      assert html =~ ~s(data-cy="user.card")
      assert html =~ ~s(data-cy="user.profile")
    end

    test "presence variants: data-presence attrs + hidden dot + clamp" do
      html = render_gallery()

      assert html =~ ~s(data-presence="online")
      assert html =~ ~s(data-presence="away")
      assert html =~ ~s(data-presence="offline")
      assert html =~ ~s(data-presence="hidden")
      # bogus presence clamps to offline — the "Bogus Presence" card
      assert html =~ "Bogus Presence"
    end

    test "CTAs: disabled state mirrors blank ids (bindings ship via the client bundle, not SSR)" do
      html = render_gallery()

      # SSR strips $-bindings (renderer drops $-attrs server-side); the
      # host-forwarding action contract is compile-verified. What SSR shows
      # is the disabled state for blank agent/user ids.
      assert html =~ ~s(disabled="true")
      assert html =~ "Chat"
      assert html =~ "Profile"
    end

    test "capabilities off omits the caps list" do
      html = render_gallery()
      # one AgentCard renders caps, the disabled one does not — count <ul> hooks
      assert html |> String.split(~s(data-cy="agent.caps")) |> length() == 2
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
end

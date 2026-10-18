import XCTest
@testable import ToborKitCore

final class ModelDecodingTests: XCTestCase {

    func testGuideProjectionDecodesFullPayload() throws {
        let json = """
        {
          "slug": "deploy-guide",
          "name": "Tobor",
          "title": "Deployment Guide",
          "greeting": "Shipping something? Tell me the app.",
          "bundle_hash": "sha256:abc123",
          "capabilities": [{"id": "check-branch", "description": "Report branch status"}],
          "modes": ["text", "voice", "transcript"],
          "default_mode": "text",
          "ui": {
            "robot": {
              "renderer": "glyph",
              "states": {"thinking": {"segment": "think", "loop": true, "speed": 1.2}},
              "reduced_motion": "respect"
            },
            "panel": {"placement": "floating", "start_expanded": false,
                      "show_tool_list": true, "show_task_menu": true},
            "theme": {"--tobor-accent": "#7c5cff"}
          },
          "auth": {
            "required": true,
            "provider": "authentik",
            "issuer": "https://auth.derobot.is/application/o/tobor-kit/",
            "client_id": "tobor-kit",
            "scopes": ["openid", "email", "profile"],
            "redirect_path": "/auth/oidc/callback"
          },
          "telemetry": {"enabled": true, "default": "on", "user_overridable": true},
          "voice": {"adapter": "realtime", "push_to_talk": false,
                    "mint_path": "/api/tobor-kit/voice/token", "locale": "en-US"},
          "transcript": {"store": "local", "retain_turns": 200}
        }
        """
        let projection = try ToborJSON.decode(GuideProjection.self, from: Data(json.utf8))

        XCTAssertEqual(projection.slug, "deploy-guide")
        XCTAssertEqual(projection.bundleHash, "sha256:abc123")
        XCTAssertEqual(projection.modes, [.text, .voice, .transcript])
        XCTAssertEqual(projection.defaultMode, .text)
        XCTAssertEqual(projection.resolvedDefaultMode, .text)
        XCTAssertEqual(projection.ui.robot.renderer, .glyph)
        XCTAssertEqual(projection.ui.robot.reducedMotion, .respect)
        XCTAssertEqual(projection.ui.robot.animation(for: .thinking).speed, 1.2)
        XCTAssertEqual(projection.ui.panel.placement, .floating)
        XCTAssertEqual(projection.auth.provider, .authentik)
        XCTAssertEqual(projection.auth.clientID, "tobor-kit")
        XCTAssertEqual(projection.telemetry.default, .on)
        XCTAssertEqual(projection.voice.adapter, .realtime)
        XCTAssertEqual(projection.transcript.store, .local)
    }

    func testGuideProjectionDropsUnknownModes() throws {
        // A server that grows a fourth mode must not brick an older client.
        let json = """
        {"slug": "g", "name": "G",
         "modes": ["text", "telepathy", "voice"],
         "default_mode": "telepathy",
         "ui": {}, "auth": {}, "telemetry": {}, "voice": {}, "transcript": {}}
        """
        let projection = try ToborJSON.decode(GuideProjection.self, from: Data(json.utf8))
        XCTAssertEqual(projection.modes, [.text, .voice])
        // The unknown default falls through to the first offered mode.
        XCTAssertEqual(projection.resolvedDefaultMode, .text)
    }

    func testGuideProjectionUnknownRendererFallsBackToGlyph() throws {
        // `glyph` needs no assets and therefore always renders something.
        let json = """
        {"slug": "g", "name": "G", "modes": ["text"],
         "ui": {"robot": {"renderer": "hologram"}}, "auth": {}, "telemetry": {}, "voice": {}, "transcript": {}}
        """
        let projection = try ToborJSON.decode(GuideProjection.self, from: Data(json.utf8))
        XCTAssertEqual(projection.ui.robot.renderer, .glyph)
    }

    func testGuideProjectionSchemaDefaultsApplyWhenFieldsAreAbsent() throws {
        let json = """
        {"slug": "g", "name": "G",
         "ui": {"panel": {}, "robot": {}, "theme": {}},
         "auth": {}, "telemetry": {}, "voice": {}, "transcript": {}}
        """
        let projection = try ToborJSON.decode(GuideProjection.self, from: Data(json.utf8))
        // From tobor.guide-definition defaults.
        XCTAssertTrue(projection.ui.panel.showToolList)
        XCTAssertTrue(projection.ui.panel.showTaskMenu)
        XCTAssertFalse(projection.ui.panel.startExpanded)
        XCTAssertEqual(projection.ui.robot.reducedMotion, .respect)
        XCTAssertEqual(projection.telemetry.default, .on)
        XCTAssertTrue(projection.telemetry.userOverridable)
        XCTAssertEqual(projection.voice.adapter, .realtime)
        XCTAssertEqual(projection.auth.required, true)
        XCTAssertEqual(projection.transcript.store, .memory)
    }

    func testNoPreambleLeak() throws {
        // The client-side model has no field a compiled preamble could land in.
        // Guarded reflectively so a future field cannot grow silently.
        let keys = Set(Mirror(reflecting: GuideProjection(
            slug: "s", name: "n"
        )).children.compactMap(\.label))
        XCTAssertFalse(keys.contains("preamble"))
        XCTAssertFalse(keys.contains("prompt"))
        XCTAssertFalse(keys.contains("systemPrompt"))
    }

    func testTelemetryConsentSources() throws {
        func consent(_ json: String) throws -> TelemetryConsent {
            try ToborJSON.decode(TelemetryConsent.self, from: Data(json.utf8))
        }

        let user = try consent(#"{"enabled": false, "source": "user", "user_overridable": true}"#)
        XCTAssertEqual(user.source, .user)
        XCTAssertFalse(user.enabled)
        XCTAssertTrue(user.isTogglePresentable)

        let fallback = try consent(#"{"enabled": true, "source": "default", "user_overridable": true}"#)
        XCTAssertEqual(fallback.source, .default)
        XCTAssertTrue(fallback.isTogglePresentable)

        let forced = try consent(#"""
            {"enabled": true, "source": "forced", "user_overridable": false,
             "capture": {"prompt": true, "response": true, "tool_args": false, "tool_results": false}}
            """#)
        XCTAssertEqual(forced.source, .forced)
        XCTAssertTrue(forced.enabled)
        XCTAssertFalse(forced.isTogglePresentable)
        XCTAssertEqual(forced.capture?.prompt, true)
        XCTAssertEqual(forced.capture?.toolArgs, false)
    }

    func testTogglePresentableHonorsEitherForcingSignal() throws {
        // A well-behaved server sets both signals together; a sloppy one that
        // sets only one must still not coax a toggle on screen.
        let forcedSource = TelemetryConsent(enabled: true, source: .forced, userOverridable: true)
        XCTAssertFalse(forcedSource.isTogglePresentable)
        let notOverridable = TelemetryConsent(enabled: true, source: .default, userOverridable: false)
        XCTAssertFalse(notOverridable.isTogglePresentable)
    }

    func testToolInventoryDecodesWithDegradedServers() throws {
        let json = """
        {
          "groups": [{"id": "github", "label": "Github"}, {"id": "tickets", "label": "Tickets"}],
          "tools": [
            {"name": "Github.PullCreate", "label": "Open a PR", "group": "github",
             "confirm": true, "read_only": false,
             "input_schema": {"type": "object", "properties": {"title": {"type": "string"}}}},
            {"name": "Ticket.Create", "label": "File a ticket", "group": "tickets", "read_only": false}
          ],
          "degraded": [{"server": "search", "error": "connection refused"}]
        }
        """
        let inventory = try ToborJSON.decode(ToolInventory.self, from: Data(json.utf8))

        XCTAssertTrue(inventory.isDegraded)
        XCTAssertEqual(inventory.degraded.first?.server, "search")
        XCTAssertEqual(inventory.tools.count, 2)
        XCTAssertTrue(inventory.tools[0].confirm)
        XCTAssertEqual(inventory.tools[0].inputSchema?["type"], .string("object"))

        let sections = inventory.sections()
        XCTAssertEqual(sections.map(\.group.id), ["github", "tickets"])
        XCTAssertEqual(sections[0].tools.map(\.name), ["Github.PullCreate"])
    }

    func testOrphanToolsGetASynthesisedSection() throws {
        // A tool whose group matches nothing declared must still render — a
        // silently vanishing menu entry is a degraded list with no banner.
        let json = """
        {"groups": [{"id": "github", "label": "Github"}],
         "tools": [{"name": "Mystery.Tool", "label": "Mystery", "group": "nowhere"}]}
        """
        let inventory = try ToborJSON.decode(ToolInventory.self, from: Data(json.utf8))
        let sections = inventory.sections()
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections[0].group.id, "_other")
        XCTAssertEqual(sections[0].tools.map(\.name), ["Mystery.Tool"])
    }

    func testVoiceCredentialDecodes() throws {
        let json = """
        {"adapter": "realtime", "expires_at": "2026-08-31T12:05:00Z",
         "realtime": {"token": "ek_live_ephemeral", "url": "wss://provider/realtime",
                      "model": "gpt-realtime-2.1-mini", "voice": "marin"}}
        """
        let credential = try ToborJSON.decode(VoiceCredential.self, from: Data(json.utf8))
        XCTAssertEqual(credential.adapter, .realtime)
        XCTAssertEqual(credential.realtime?.token, "ek_live_ephemeral")
        XCTAssertFalse(credential.isExpired(at: Date(timeIntervalSince1970: 0)))
    }
}

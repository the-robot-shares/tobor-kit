import XCTest
import SwiftUI
import ToborKitCore
@testable import ToborKitUI

#if canImport(AppKit)
import AppKit
#endif

/// Smoke tests: every view constructs and renders for every canonical state.
/// This is the UI-side mirror of the state contract — seven states, no more,
/// and a view that fails to build on any of them is a shipped crash.
final class ViewSmokeTests: XCTestCase {

    @MainActor
    private func makeModel(state: GuideState) -> GuideModel {
        let model = GuideModel(client: GuideClient(
            baseURL: URL(string: "https://example.test/api/tobor-kit")!
        ))
        model.projection = GuideProjection(
            slug: "deploy-guide",
            name: "Tobor",
            title: "Deployment Guide",
            greeting: "Shipping something?",
            modes: [.text, .voice, .transcript],
            defaultMode: .text
        )
        model.consent = TelemetryConsent(enabled: true, source: .default, userOverridable: true)
        model.inventory = ToolInventory(
            groups: [ToolGroup(id: "github", label: "Github")],
            tools: [Tool(name: "Github.PullCreate", label: "Open a PR", group: "github", confirm: true)],
            degraded: [DegradedServer(server: "search", error: "timeout")]
        )
        model.state = state
        return model
    }

    @MainActor
    func testPanelConstructsForAllSevenStates() {
        for state in GuideState.allCases {
            let model = makeModel(state: state)
            render(GuidePanelView(model: model), name: "panel-\(state.rawValue)")
        }
    }

    @MainActor
    func testAvatarConstructsForAllStatesAndRenderers() {
        for state in GuideState.allCases {
            for renderer in RobotRenderer.allCases {
                for policy in ReducedMotionPolicy.allCases {
                    render(
                        RobotAvatarView(renderer: renderer, state: state, reducedMotion: policy),
                        name: "avatar-\(renderer.rawValue)-\(state.rawValue)"
                    )
                }
            }
        }
    }

    @MainActor
    func testMotionPolicyRespectsReducedMotion() {
        // force_static and ignore are absolute; `respect` follows the (test
        // host's) system setting — only the absolute ones are assertable here.
        let forced = RobotAvatarView(renderer: .glyph, state: .speaking, reducedMotion: .forceStatic)
        let ignore = RobotAvatarView(renderer: .glyph, state: .speaking, reducedMotion: .ignore)
        XCTAssertFalse(forced.motionAllowed)
        XCTAssertTrue(ignore.motionAllowed)
    }

    @MainActor
    func testTelemetryToggleHiddenWhenForced() {
        let model = makeModel(state: .idle)
        model.consent = TelemetryConsent(enabled: true, source: .forced, userOverridable: false)
        XCTAssertFalse(model.showsTelemetryToggle)

        model.consent = TelemetryConsent(enabled: true, source: .user, userOverridable: true)
        XCTAssertTrue(model.showsTelemetryToggle)

        // A sloppy server that sets only one forcing signal still hides it.
        model.consent = TelemetryConsent(enabled: true, source: .forced, userOverridable: true)
        XCTAssertFalse(model.showsTelemetryToggle)
        model.consent = TelemetryConsent(enabled: true, source: .default, userOverridable: false)
        XCTAssertFalse(model.showsTelemetryToggle)
    }

    @MainActor
    func testThemeParsing() {
        let theme = ToborTheme(theme: [
            "--tobor-accent": "#7c5cff",
            "--tobor-surface": "#12121a",
            "--tobor-unknown": "#ff0000"
        ])
        XCTAssertEqual(
            theme.accent,
            Color(.sRGB, red: 124.0 / 255.0, green: 92.0 / 255.0, blue: 1.0)
        )
        XCTAssertNotEqual(theme.surface, ToborTheme.default.surface)

        // Named CSS colors are not guessed at; defaults hold.
        let fallback = ToborTheme(theme: ["--tobor-accent": "rebeccapurple"])
        XCTAssertEqual(fallback.accent, ToborTheme.default.accent)
    }

    @MainActor
    func testToolApprovalQueue() {
        let queue = ToolApprovalQueue()
        let request = ToolApprovalRequest(toolName: "Github.PullCreate", label: "Open a PR", summary: "a PR")
        queue.submit(request)
        XCTAssertEqual(queue.pending.count, 1)
        // Deny consumes without dispatching.
        XCTAssertNil(queue.decide(id: request.id, approve: false))
        XCTAssertTrue(queue.pending.isEmpty)
        // Approve hands the request back so the turn can carry the task id.
        queue.submit(request)
        let approved = queue.decide(id: request.id, approve: true)
        XCTAssertEqual(approved?.toolName, "Github.PullCreate")
        // Stale ids answer nil rather than crashing.
        XCTAssertNil(queue.decide(id: UUID(), approve: true))
    }

    // MARK: Rendering helper

    /// Forces the view's body to actually evaluate by mounting it in a live
    /// hosting view. Constructing a view struct alone would not.
    @MainActor
    @discardableResult
    private func render(_ view: some View, name: String) -> NSView {
        let hosting = NSHostingView(rootView: view.frame(width: 340, height: 420))
        hosting.frame = NSRect(x: 0, y: 0, width: 340, height: 420)
        hosting.layoutSubtreeIfNeeded()
        return hosting
    }
}

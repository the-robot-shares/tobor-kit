import XCTest
import SwiftUI
import ToborKitCore
@testable import ToborKitUI

/// Tests for the `<noizu-model-config>` mirror, ported from the lit element's
/// `test/` suite expectations: the masked-key rule, catalog payload parsing,
/// and the picker's selection semantics must behave identically on both
/// surfaces.
final class ModelConfigMirrorTests: XCTestCase {

    // MARK: Spec / sentinel semantics

    func testSpecOfFallsBackToProviderModel() {
        XCTAssertEqual(specOf(ModelCatalogEntry(provider: "openai", model: "gpt-4.1")), "openai:gpt-4.1")
        XCTAssertEqual(
            specOf(ModelCatalogEntry(provider: "a", model: "b", spec: " x:y ")),
            "x:y",
            "explicit spec wins and is trimmed"
        )
    }

    func testInheritAndCustomValues() {
        XCTAssertTrue(isInheritValue(""))
        XCTAssertTrue(isInheritValue("inherit"))
        XCTAssertFalse(isInheritValue("openai:gpt-4.1"))
        XCTAssertTrue(isCustomValue("custom:gpt-4.1"))
        XCTAssertFalse(isCustomValue("openai:gpt-4.1"))
        XCTAssertEqual(customSpec(model: "  gpt  "), "custom:gpt")
        XCTAssertEqual(customSpec(model: "  "), "custom", "empty model degrades to the bare prefix")
    }

    // MARK: The masked-key rule — never save an echo, never log a key

    func testMaskedSecretDetection() {
        XCTAssertTrue(isMaskedSecret("••••1234"))
        XCTAssertTrue(isMaskedSecret("***stored"))
        XCTAssertTrue(isMaskedSecret("XXXX-key"))
        XCTAssertFalse(isMaskedSecret(""))
        XCTAssertFalse(isMaskedSecret("sk-real-key-material"))
    }

    func testApiKeyForSave() {
        XCTAssertEqual(apiKeyForSave(""), "", "empty means keep the stored key")
        XCTAssertEqual(apiKeyForSave("  ••••1234 "), "", "masked echo means keep the stored key")
        XCTAssertEqual(apiKeyForSave(" sk-live-abc "), "sk-live-abc", "a real key saves trimmed")
    }

    // MARK: Catalog payload parsing (array, {catalog}, {models}, {entries})

    func testParseBareArray() {
        let json = JSONValue.array([
            .object(["provider": .string("openai"), "model": .string("gpt-4.1"), "label": .string("GPT-4.1")]),
            .object(["provider": .string("x"), "model": .string("y"), "spec": .string("x:y")]),
            .object(["provider": .string("no-model")]),
        ])
        let entries = parseCatalogEntries(json)
        XCTAssertEqual(entries.count, 2, "entries without both provider+model are dropped")
        XCTAssertEqual(entries[0].label, "GPT-4.1")
        XCTAssertEqual(specOf(entries[1]), "x:y")
    }

    func testParseWrappedPayloads() {
        let entry = JSONValue.object(["provider": .string("openai"), "model": .string("gpt-4.1")])
        for key in ["catalog", "models", "entries"] {
            let json = JSONValue.object([key: .array([entry])])
            XCTAssertEqual(parseCatalogEntries(json).count, 1, "wrapper key \(key) is recognized")
        }
        XCTAssertEqual(parseCatalogEntries(.object([:])).count, 0)
    }

    func testParseCustomEndpoint() {
        let json = JSONValue.object([
            "catalog": .array([]),
            "custom_endpoint": .object([
                "base_url": .string("https://api.example.test/v1"),
                "model": .string("m"),
                "api_key": .string("••••1234"),
            ]),
        ])
        let custom = parseCustomEndpoint(json)
        XCTAssertEqual(custom?.baseUrl, "https://api.example.test/v1")
        XCTAssertEqual(custom?.model, "m")
        XCTAssertEqual(custom?.apiKey, "••••1234")

        // All-empty custom objects are absent, not present-and-blank.
        let blank = JSONValue.object(["custom": .object(["baseUrl": .string("")])])
        XCTAssertNil(parseCustomEndpoint(blank))
        XCTAssertNil(parseCustomEndpoint(.array([])))
    }

    // MARK: Selection resolution (selectValue / isCustomSelection / orphanOption)

    private let entries = [
        ModelCatalogEntry(provider: "openai", model: "gpt-4.1"),
        ModelCatalogEntry(provider: "noizu", model: "tobor-local", spec: "noizu:tobor-local"),
    ]

    func testResolveInherit() {
        XCTAssertEqual(
            ModelPickerSelection.resolve(value: "", inherit: true, allowCustom: false, entries: entries),
            .inherit
        )
        // Without the inherit option an empty value is the placeholder.
        XCTAssertEqual(
            ModelPickerSelection.resolve(value: "", inherit: false, allowCustom: false, entries: entries),
            .catalog("")
        )
    }

    func testResolveCustomAndOrphans() {
        XCTAssertEqual(
            ModelPickerSelection.resolve(value: "custom:m", inherit: false, allowCustom: true, entries: entries),
            .custom
        )
        // A stored value matching no entry routes to Custom… when allowed.
        XCTAssertEqual(
            ModelPickerSelection.resolve(value: "gone:model", inherit: false, allowCustom: true, entries: entries),
            .custom
        )
        // Without allowCustom the same value renders as an orphan option —
        // the host's value is never silently lost.
        XCTAssertEqual(
            ModelPickerSelection.resolve(value: "gone:model", inherit: false, allowCustom: false, entries: entries),
            .orphan("gone:model")
        )
        XCTAssertEqual(
            ModelPickerSelection.resolve(value: "openai:gpt-4.1", inherit: false, allowCustom: true, entries: entries),
            .catalog("openai:gpt-4.1")
        )
    }

    // MARK: View smoke — construct and render for every flag combination

    @MainActor
    private func render(_ view: some View, name: String) {
        let hosting = NSHostingView(rootView: view.frame(width: 340, height: 420))
        hosting.frame = NSRect(x: 0, y: 0, width: 340, height: 420)
        hosting.layoutSubtreeIfNeeded()
    }

    @MainActor
    func testModelConfigViewConstructsAndRenders() {
        for inherit in [true, false] {
            for allowCustom in [true, false] {
                for value in ["", "openai:gpt-4.1", "custom:m", "gone:model"] {
                    render(
                        ModelConfigView(
                            catalog: entries,
                            value: .constant(value),
                            inherit: inherit,
                            allowCustom: allowCustom,
                            allowBudget: true,
                            budget: .constant(nil),
                            customEndpoint: CustomEndpoint(baseUrl: "https://x.test/v1", model: "m", apiKey: "••••1234")
                        ),
                        name: "model-config-\(inherit)-\(allowCustom)-\(value)"
                    )
                }
            }
        }
    }

    @MainActor
    func testPersonaAndQueueViewsConstructAndRender() {
        render(PersonaCardView(persona: PersonaIdentity(id: "nova", name: "Nova", handle: "@nova")), name: "persona-card")
        render(
            PersonaPickerView(personas: [PersonaIdentity(id: "nova", name: "Nova")], query: "no", onSelect: { _ in }),
            name: "persona-picker-empty-result"
        )
        render(
            TaskQueueStripView(inventory: ToolInventory(
                groups: [ToolGroup(id: "github", label: "Github")],
                tools: [Tool(name: "Github.PullCreate", label: "Open a PR", group: "github", confirm: true)],
                degraded: [DegradedServer(server: "wiki", error: "timeout")]
            ), onInvoke: { _ in }),
            name: "task-queue-strip-degraded"
        )
    }
}

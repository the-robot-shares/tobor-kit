import SwiftUI
import ToborKitCore
import ToborKitUI

/// The Swift component browser — the mirror of the infra web browser at
/// `infra.noizu.com/lit-dev`.
///
/// Same structure as the web page: a catalog grid (sidebar here) grouped by
/// the YAML `group` field, a detail pane with the description, and a **live
/// preview** frame fed with sample data (the web page's demo frame — demoHtml
/// / demoProps in the YAML). Runs on macOS 14+ and iOS 17+; primary use is
/// `swift run ToborKitCatalog` on macOS.
@main
struct ToborKitCatalogApp: App {
    var body: some Scene {
        WindowGroup("ToborKit Catalog") {
            CatalogRootView()
        }
    }
}

struct CatalogRootView: View {
    @State private var selected: CatalogEntry?

    var body: some View {
        NavigationSplitView {
            List(selection: $selected) {
                ForEach(ComponentCatalog.grouped(), id: \.group) { section in
                    Section(section.group.capitalized) {
                        ForEach(section.entries) { entry in
                            NavigationLink(value: entry) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(entry.name)
                                    Text(entry.tag)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationSplitViewColumnWidth(min: 220, ideal: 260)
        } detail: {
            if let entry = selected {
                CatalogDetailView(entry: entry)
            } else {
                Text("Select a component")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(minWidth: 760, minHeight: 520)
    }
}

struct CatalogDetailView: View {
    let entry: CatalogEntry

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.name).font(.title2.bold())
                    HStack(spacing: 8) {
                        Text(entry.tag)
                            .font(.caption.monospaced())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.15), in: RoundedRectangle(cornerRadius: 4))
                        Text("mirror: \(entry.swiftTypes.joined(separator: ", "))")
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                        backendBadge
                    }
                }
                Text(entry.description)

                Divider()
                Text("Live preview").font(.headline)
                preview
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))

                Text("Source: web/src/components/\(entry.slug)/swift/ · lit: web/src/components/\(entry.slug)/")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(20)
            .frame(maxWidth: 640, alignment: .leading)
        }
    }

    private var backendBadge: some View {
        Text(entry.backend == "none" ? "host-fed" : "backend: \(entry.backend)")
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                entry.backend == "none" ? Color.gray.opacity(0.2) : Color.accentColor.opacity(0.2),
                in: Capsule()
            )
    }

    /// The demo frame: every mirrored component, live, with sample data.
    @ViewBuilder
    private var preview: some View {
        switch entry.slug {
        case "guide-panel":
            GuidePreview()
        case "robot-avatar":
            HStack(spacing: 16) {
                ForEach(GuideState.allCases, id: \.self) { state in
                    VStack(spacing: 4) {
                        RobotAvatarView(renderer: .glyph, state: state)
                            .frame(width: 44, height: 44)
                        Text(state.rawValue)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        case "task-menu":
            TaskQueueStripView(
                inventory: SampleData.inventory,
                onInvoke: { _ in }
            )
        case "telemetry-toggle":
            VStack(alignment: .leading, spacing: 8) {
                Text("Overridable — toggle shows").font(.caption).foregroundStyle(.secondary)
                TelemetryConsentToggle(model: SampleData.guideModel(consent: TelemetryConsent(enabled: true, source: .user, userOverridable: true)))
                Text("Forced — toggle renders nothing").font(.caption).foregroundStyle(.secondary)
                TelemetryConsentToggle(model: SampleData.guideModel(consent: TelemetryConsent(enabled: true, source: .forced, userOverridable: false)))
            }
        case "model-config":
            ModelConfigPreview()
        case "persona":
            VStack(alignment: .leading, spacing: 12) {
                PersonaCardView(persona: SampleData.personas[0], state: .thinking)
                PersonaPickerPreview()
                    .frame(height: 200)
            }
        default:
            Text("No preview").foregroundStyle(.secondary)
        }
    }
}

// MARK: - Sample data (the demoProps of the Swift browser)

@MainActor
enum SampleData {
    static let personas = [
        PersonaIdentity(id: "nova", name: "Nova", handle: "@nova"),
        PersonaIdentity(id: "orbit", name: "Orbit", handle: "@orbit"),
        PersonaIdentity(id: "pip", name: "Pip"),
    ]

    static let inventory = ToolInventory(
        groups: [
            ToolGroup(id: "github", label: "Github"),
            ToolGroup(id: "search", label: "Search"),
        ],
        tools: [
            Tool(name: "Github.PullCreate", label: "Open a PR", group: "github", confirm: true),
            Tool(name: "Github.IssueList", label: "List issues", group: "github"),
            Tool(name: "Search.Query", label: "Search docs", group: "search"),
        ],
        degraded: [DegradedServer(server: "wiki", error: "timeout")]
    )

    static func guideModel(
        consent: TelemetryConsent,
        projection: GuideProjection? = nil
    ) -> GuideModel {
        GuideModel(
            client: GuideClient(
                baseURL: URL(string: "https://example.test/api/tobor-kit")!
            ),
            seedProjection: projection,
            seedConsent: consent,
            seedInventory: inventory
        )
    }
}

private let previewProjection = GuideProjection(
    slug: "deploy-guide",
    name: "Tobor",
    title: "Deployment Guide",
    greeting: "Shipping something?",
    modes: [.text, .voice, .transcript],
    defaultMode: .text
)

private struct GuidePreview: View {
    @State private var model: GuideModel = SampleData.guideModel(
        consent: TelemetryConsent(enabled: true, source: .user, userOverridable: true),
        projection: previewProjection
    )

    var body: some View {
        GuidePanelView(model: model)
            .frame(height: 320)
    }
}

private struct ModelConfigPreview: View {
    @State private var value = "openai:gpt-4.1"
    @State private var budget: Double? = 20

    var body: some View {
        ModelConfigView(
            catalog: [
                ModelCatalogEntry(provider: "openai", model: "gpt-4.1", label: "GPT-4.1"),
                ModelCatalogEntry(provider: "anthropic", model: "claude-sonnet-5", label: "Claude Sonnet 5"),
                ModelCatalogEntry(provider: "noizu", model: "tobor-local", spec: "noizu:tobor-local"),
            ],
            value: $value,
            inherit: true,
            allowCustom: true,
            allowBudget: true,
            budget: $budget,
            customEndpoint: CustomEndpoint(baseUrl: "https://api.openai.com/v1", model: "gpt-4.1", apiKey: "••••1234")
        )
        .frame(height: 320)
    }
}

private struct PersonaPickerPreview: View {
    @State private var selected: PersonaIdentity?

    var body: some View {
        PersonaPickerView(personas: SampleData.personas) { selected = $0 }
            .overlay(alignment: .bottom) {
                if let selected {
                    Text("selected: \(selected.id)")
                        .font(.caption)
                        .padding(4)
                        .background(Color.secondary.opacity(0.15), in: Capsule())
                }
            }
    }
}

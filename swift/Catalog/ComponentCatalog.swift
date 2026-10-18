import Foundation
import ToborKitCore
import ToborKitUI

/// The Swift component browser's catalog — the mirror of the web browser's
/// `infra.noizu.com/data/lit-components.yaml`.
///
/// The YAML is the source of truth for the lit side; this registry mirrors
/// its shape (slug / name / tag / group / description / backend) and adds the
/// Swift pairing (type + folder), so the browser app and the catalog table in
/// docs/SWIFT-CONVENTIONS.md stay derived from one Swift list. Adding a Swift
/// mirror means adding it here AND to the `uiSources` inventory in
/// `Package.swift`.
struct CatalogEntry: Identifiable, Hashable {
    /// Mirrors the YAML `slug` (and the lit component folder name).
    let slug: String
    let name: String
    /// The lit element tag this type mirrors.
    let tag: String
    /// Mirrors the YAML `group` (agent / display / navigation / input).
    let group: String
    let description: String
    /// The Swift type(s) in the mirror.
    let swiftTypes: [String]
    /// The backend badge, mirroring the YAML `backend` field ("none" here —
    /// these views are host-fed, like their lit siblings).
    let backend: String

    var id: String { slug }
}

enum ComponentCatalog {
    static let entries: [CatalogEntry] = [
        CatalogEntry(
            slug: "guide-panel",
            name: "Guide Panel",
            tag: "tobor-guide-panel",
            group: "agent",
            description: """
                The orchestrator: floating peek/expand companion panel with \
                avatar, mode toggle, transcript, task menu, tool approvals and \
                telemetry consent. Consumes only the config projection from \
                GET /guide; prompt-shaped content stays server-side.
                """,
            swiftTypes: ["GuidePanelView", "GuideModel"],
            backend: "elixir"
        ),
        CatalogEntry(
            slug: "robot-avatar",
            name: "Robot Avatar",
            tag: "tobor-robot-avatar",
            group: "display",
            description: """
                A state machine over exactly the seven canonical guide states \
                (idle, listening, thinking, speaking, tool_running, error, \
                offline). No client-side state inference — SSE `state` events \
                drive it, same as the web element.
                """,
            swiftTypes: ["RobotAvatarView"],
            backend: "none"
        ),
        CatalogEntry(
            slug: "task-menu",
            name: "Task Menu",
            tag: "tobor-task-menu",
            group: "navigation",
            description: """
                The task/queue surface: a verbatim render of GET /mcp/tools \
                (chips strip + confirmation queue for `confirm: true` tools), \
                with degraded servers surfaced inline, never dropped.
                """,
            swiftTypes: ["TaskQueueStripView", "ToolApprovalQueue"],
            backend: "elixir"
        ),
        CatalogEntry(
            slug: "telemetry-toggle",
            name: "Telemetry Toggle",
            tag: "tobor-telemetry-toggle",
            group: "input",
            description: """
                Renders nothing unless the resolved consent actually allows a \
                user override (`source: forced` or `user_overridable: false` \
                alone is enough to hide it). PUT 403 maps to a distinct error.
                """,
            swiftTypes: ["TelemetryConsentToggle"],
            backend: "elixir"
        ),
        CatalogEntry(
            slug: "model-config",
            name: "Model Config",
            tag: "noizu-model-config",
            group: "input",
            description: """
                The model picker island: provider/model catalog selection, \
                inherit/custom semantics, optional budget, and an \
                OpenAI-compatible custom endpoint editor. Empty or masked API \
                keys save as "" ("keep the stored key"); keys are never logged.
                """,
            swiftTypes: ["ModelConfigView", "ModelCatalogEntry"],
            backend: "none"
        ),
        CatalogEntry(
            slug: "llm-inference",
            name: "LLM Inference",
            tag: "tobor-llm-inference",
            group: "input",
            description: """
                Direct provider inference settings, ported 1:1 from \
                llm-toolkit's Settings page: provider picker (Cloud / \
                Proxies & Local / Advanced), masked API key with env-var \
                resolution, inline base-URL override, model fetch + free \
                text, and a Test Connection box with a "<provider> \
                connected" status badge. Complements model-config (host \
                schema) — this models the provider call.
                """,
            swiftTypes: [
                "LLMInferenceSettingsView", "LLMInferenceClient", "LLMInferenceConfig", "LLMProvider",
                "LLMModality",
            ],
            backend: "none"
        ),
        CatalogEntry(
            slug: "persona",
            name: "Persona Card & Picker",
            tag: "tobor-persona-card",
            group: "agent",
            description: """
                Robot identity card and searchable picker over a \
                host-supplied roster. Selecting is a callback — no navigation, \
                no fetching, same contract as the lit island.
                """,
            swiftTypes: ["PersonaCardView", "PersonaPickerView"],
            backend: "none"
        ),
    ]

    /// Group order + labels mirror the web catalog's grid headings.
    static let groupOrder = ["agent", "navigation", "display", "input"]

    static func grouped() -> [(group: String, entries: [CatalogEntry])] {
        groupOrder.map { group in
            (group, entries.filter { $0.group == group })
        }.filter { !$0.entries.isEmpty }
    }
}

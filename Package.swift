// swift-tools-version: 6.0

import PackageDescription

// Interspersed layout: every Swift mirror of a lit component lives INSIDE
// that component's folder (`web/src/components/<slug>/swift/`), so the lit
// and Swift variants of the same agent component stay in sync by proximity
// (docs/SWIFT-CONVENTIONS.md). The package root is therefore the repo root,
// and the UI target enumerates its sources across both trees — SPM cannot
// auto-discover `.swift` files inside a folder that also holds TypeScript,
// so the source list below is the authoritative inventory of the Swift
// surface. Adding a mirror means adding its files here AND to
// `swift/Catalog/ComponentCatalog.swift` so the browser shows it.

// Shared tokens first, then one block per mirrored lit component.
let uiSources: [String] = [
    // styleguide — shared theme tokens (not a component mirror)
    "web/src/components/styleguide/swift/ToborTheme.swift",
    // guide-panel
    "web/src/components/guide-panel/swift/GuideModel.swift",
    "web/src/components/guide-panel/swift/GuidePanelView.swift",
    // robot-avatar
    "web/src/components/robot-avatar/swift/RobotAvatarView.swift",
    // task-menu
    "web/src/components/task-menu/swift/ToolApprovalQueue.swift",
    "web/src/components/task-menu/swift/TaskQueueStripView.swift",
    // telemetry-toggle
    "web/src/components/telemetry-toggle/swift/TelemetryConsentToggle.swift",
    // model-config
    "web/src/components/model-config/swift/ModelCatalog.swift",
    "web/src/components/model-config/swift/ModelConfigView.swift",
    // llm-inference (lit twin: web/src/components/llm-inference/llm-inference.ts)
    "web/src/components/llm-inference/swift/LLMProvider.swift",
    "web/src/components/llm-inference/swift/LLMModality.swift",
    "web/src/components/llm-inference/swift/LLMInferenceConfig.swift",
    "web/src/components/llm-inference/swift/LLMInferenceClient.swift",
    "web/src/components/llm-inference/swift/LLMInferenceSettingsView.swift",
    // persona
    "web/src/components/persona/swift/PersonaCardView.swift",
]

let swiftV6: [SwiftSetting] = [.swiftLanguageMode(.v6)]

let package = Package(
    name: "ToborKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "ToborKitCore", targets: ["ToborKitCore"]),
        .library(name: "ToborKitUI", targets: ["ToborKitUI"]),
        .executable(name: "ToborKitCatalog", targets: ["ToborKitCatalog"])
    ],
    targets: [
        .target(
            name: "ToborKitCore",
            path: "swift/Sources/ToborKitCore",
            swiftSettings: swiftV6
        ),
        .target(
            name: "ToborKitUI",
            dependencies: ["ToborKitCore"],
            path: "web/src/components",
            sources: uiSources.map { String($0.dropFirst("web/src/components/".count)) },
            swiftSettings: swiftV6
        ),
        .executableTarget(
            name: "ToborKitCatalog",
            dependencies: ["ToborKitUI", "ToborKitCore"],
            path: "swift/Catalog",
            swiftSettings: swiftV6
        ),
        .testTarget(
            name: "ToborKitCoreTests",
            dependencies: ["ToborKitCore"],
            path: "swift/Tests/ToborKitCoreTests",
            swiftSettings: swiftV6
        ),
        .testTarget(
            name: "ToborKitUITests",
            dependencies: ["ToborKitUI"],
            path: "swift/Tests/ToborKitUITests",
            swiftSettings: swiftV6
        )
    ]
)

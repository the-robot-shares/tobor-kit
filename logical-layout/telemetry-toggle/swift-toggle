import SwiftUI
import ToborKitCore

/// The telemetry consent control.
///
/// Renders **nothing** unless the resolved consent says the user may actually
/// change it: `source == .forced` or `user_overridable == false` (either
/// signal alone is enough) means the guide's default is binding, and a toggle
/// on screen for such a guide is a promise its `PUT` would answer with 403.
public struct TelemetryConsentToggle: View {

    @State private var model: GuideModel
    @State private var failure: String?

    public init(model: GuideModel) {
        _model = State(initialValue: model)
    }

    public var body: some View {
        if model.showsTelemetryToggle, let consent = model.consent {
            Toggle(isOn: Binding(
                get: { consent.enabled },
                set: { enabled in
                    Task {
                        do {
                            try await model.setTelemetry(enabled: enabled)
                            failure = nil
                        } catch {
                            // 403 lives here: the server disagreed about
                            // overridability after all. Say so; do not flip.
                            failure = error.localizedDescription
                        }
                    }
                }
            )) {
                Label("Telemetry", systemImage: "chart.bar")
                    .labelStyle(.titleAndIcon)
                    .font(.caption)
            }
            .toggleStyle(.switch)
            .controlSize(.mini)
            .help(consent.source == .user
                  ? "You chose this setting."
                  : "Guide default — you can change it.")
            .accessibilityLabel("Telemetry consent")
        }
    }
}

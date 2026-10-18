import Foundation

/// `GET/PUT /telemetry/consent`.
///
/// `enabled` is the *resolved* value actually governing content capture — not
/// the guide default, not the stored preference. `source` says which of those
/// produced it, and it is the field the UI must branch on: when it is
/// ``Source/forced`` there is no toggle to render at all.
public struct TelemetryConsent: Sendable, Codable, Hashable {
    public var enabled: Bool
    public var source: Source
    public var userOverridable: Bool
    public var capture: Capture?

    public init(
        enabled: Bool,
        source: Source,
        userOverridable: Bool,
        capture: Capture? = nil
    ) {
        self.enabled = enabled
        self.source = source
        self.userOverridable = userOverridable
        self.capture = capture
    }

    private enum CodingKeys: String, CodingKey {
        case enabled, source
        case userOverridable = "user_overridable"
        case capture
    }

    public enum Source: String, Sendable, Codable, CaseIterable, Hashable {
        /// An explicit preference is on record.
        case user
        /// Never expressed; the guide default was applied.
        case `default`
        /// `user_overridable` is false — the default is binding.
        case forced
    }

    public struct Capture: Sendable, Codable, Hashable {
        public var prompt: Bool
        public var response: Bool
        public var toolArgs: Bool
        public var toolResults: Bool

        public init(
            prompt: Bool = false,
            response: Bool = false,
            toolArgs: Bool = false,
            toolResults: Bool = false
        ) {
            self.prompt = prompt
            self.response = response
            self.toolArgs = toolArgs
            self.toolResults = toolResults
        }

        private enum CodingKeys: String, CodingKey {
            case prompt, response
            case toolArgs = "tool_args"
            case toolResults = "tool_results"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            prompt = try c.decodeIfPresent(Bool.self, forKey: .prompt) ?? false
            response = try c.decodeIfPresent(Bool.self, forKey: .response) ?? false
            toolArgs = try c.decodeIfPresent(Bool.self, forKey: .toolArgs) ?? false
            toolResults = try c.decodeIfPresent(Bool.self, forKey: .toolResults) ?? false
        }
    }

    /// Whether the consent control should appear at all.
    ///
    /// Two independent signals say "no toggle": `source == .forced` and
    /// `user_overridable == false`. A well-behaved server sets both together,
    /// but honouring either one means a server that sets only one still cannot
    /// coax a client into rendering a control whose `PUT` would 403.
    public var isTogglePresentable: Bool {
        userOverridable && source != .forced
    }
}

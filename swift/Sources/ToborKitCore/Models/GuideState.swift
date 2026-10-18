import Foundation

/// The canonical guide states, straight from the OpenAPI `GuideState` enum.
///
/// These are contract, not decoration. The server pushes them on the SSE
/// `state` event and the avatar is a state machine over exactly this set — no
/// client-side inference, which is what keeps the Swift and web surfaces from
/// drifting apart.
public enum GuideState: String, Sendable, Codable, CaseIterable, Hashable {
    case idle
    case listening
    case thinking
    case speaking
    case toolRunning = "tool_running"
    case error
    case offline
}

extension GuideState {
    /// A short, human-facing label. Host apps are free to localise instead.
    public var label: String {
        switch self {
        case .idle: return "Ready"
        case .listening: return "Listening"
        case .thinking: return "Thinking"
        case .speaking: return "Speaking"
        case .toolRunning: return "Working"
        case .error: return "Something went wrong"
        case .offline: return "Offline"
        }
    }

    /// Whether a turn is in flight. Drives input disabling.
    public var isBusy: Bool {
        switch self {
        case .thinking, .speaking, .toolRunning: return true
        case .idle, .listening, .error, .offline: return false
        }
    }
}

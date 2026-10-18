import Foundation

/// `POST /voice/token` — always short-lived, always minted server-side.
///
/// There is no code path in ToborKit that accepts a provider API key from the
/// host app. If a long-lived key ever appears in a client, it did not come from
/// here.
public struct VoiceCredential: Sendable, Codable, Hashable {
    public var adapter: Adapter
    public var expiresAt: Date
    public var realtime: Realtime?
    public var backend: Backend?

    public init(
        adapter: Adapter,
        expiresAt: Date,
        realtime: Realtime? = nil,
        backend: Backend? = nil
    ) {
        self.adapter = adapter
        self.expiresAt = expiresAt
        self.realtime = realtime
        self.backend = backend
    }

    private enum CodingKeys: String, CodingKey {
        case adapter
        case expiresAt = "expires_at"
        case realtime, backend
    }

    /// Only the two adapters that need a credential appear here. `native` never
    /// reaches this type — the endpoint answers 409 for it.
    public enum Adapter: String, Sendable, Codable, Hashable {
        case realtime, backend
    }

    public struct Realtime: Sendable, Codable, Hashable {
        /// Ephemeral provider token. Never a long-lived key.
        public var token: String?
        public var url: String?
        public var model: String?
        public var voice: String?

        public init(token: String? = nil, url: String? = nil, model: String? = nil, voice: String? = nil) {
            self.token = token
            self.url = url
            self.model = model
            self.voice = voice
        }
    }

    public struct Backend: Sendable, Codable, Hashable {
        public var sttURL: String?
        public var ttsURL: String?

        public init(sttURL: String? = nil, ttsURL: String? = nil) {
            self.sttURL = sttURL
            self.ttsURL = ttsURL
        }

        private enum CodingKeys: String, CodingKey {
            case sttURL = "stt_url"
            case ttsURL = "tts_url"
        }
    }

    public func isExpired(at now: Date = Date()) -> Bool { expiresAt <= now }
}

/// The result of asking for a voice credential.
///
/// 409 is not a failure: for the `native` adapter it is the correct answer, and
/// modelling it as a case rather than a thrown error stops every call site from
/// having to remember that.
public enum VoiceTokenOutcome: Sendable, Hashable {
    case minted(VoiceCredential)
    /// HTTP 409 — the configured adapter needs no server-minted credential.
    case notRequired
}

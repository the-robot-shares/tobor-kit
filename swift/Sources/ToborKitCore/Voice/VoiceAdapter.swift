import Foundation

/// Connection lifecycle for a voice adapter, shaped after the proven
/// `RealtimeVoiceConnectionState` from robocalc.
public enum VoiceConnectionState: Equatable, Sendable {
    case idle
    case connecting
    case connected
    case disconnecting
    case failed(String)
}

/// One line of voice conversation, shaped after
/// `RealtimeVoiceTranscriptEntry` — the same four speakers the turn stream
/// reports, so voice and text share one transcript model.
public struct VoiceTranscriptEntry: Identifiable, Equatable, Sendable {
    public enum Speaker: String, Sendable {
        case user
        case assistant
        case toolCall = "tool_call"
        case toolResult = "tool_result"
    }

    public var id: UUID
    public var speaker: Speaker
    public var text: String

    public init(id: UUID = UUID(), speaker: Speaker, text: String) {
        self.id = id
        self.speaker = speaker
        self.text = text
    }
}

/// A pluggable voice transport. ToborKit ships the protocol and the token
/// plumbing; a concrete adapter (OpenAI Realtime over WS/WebRTC, the platform
/// speech stack, a backend STT/TTS pair) is registered by the host.
///
/// The adapter never sees a provider API key — only what ``VoiceCredential``
/// carries, which is always a short-lived, server-minted credential. For the
/// `native` adapter the mint answers 409 and ``VoiceTokenOutcome/notRequired``
/// arrives instead: that is the expected path, not an error.
public protocol VoiceAdapting: AnyObject, Sendable {

    var connectionState: VoiceConnectionState { get }

    /// Begin a session with the given (possibly `.notRequired`) credential.
    func start(credential: VoiceTokenOutcome) async throws

    /// End the session. Must be safe to call from any state.
    func stop() async
}

/// Mints voice credentials and hands them to the active adapter, so no view
/// ever talks to `/voice/token` directly and no adapter ever talks to the API.
@MainActor
public final class VoiceAdapterHost {

    public private(set) var adapter: (any VoiceAdapting)?

    public init(adapter: (any VoiceAdapting)? = nil) {
        self.adapter = adapter
    }

    public func setAdapter(_ adapter: (any VoiceAdapting)?) {
        self.adapter = adapter
    }

    /// Mint a credential and start the adapter with it.
    ///
    /// - Throws: ``ToborError/voiceUnavailable`` on 503 (voice disabled or the
    ///   provider unconfigured) — the button should not have been reachable.
    public func start(client: GuideClient) async throws {
        guard let adapter else { return }
        let outcome = try await client.mintVoiceToken()
        try await adapter.start(credential: outcome)
    }

    public func stop() async {
        await adapter?.stop()
    }
}

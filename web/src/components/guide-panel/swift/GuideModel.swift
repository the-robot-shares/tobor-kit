import SwiftUI
import ToborKitCore

/// One rendered line in the guide panel. Four speakers, matching the turn
/// stream's vocabulary — the same shape as robocalc's
/// `RealtimeVoiceTranscriptEntry`, so voice and text feed one list.
public struct GuideTranscriptEntry: Identifiable, Equatable, Sendable {
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

/// The observable state behind the guide panel.
///
/// Owns one session: loads the config projection, the resolved telemetry
/// consent and the dressed tool inventory; streams turns; and mirrors the
/// server-pushed ``GuideState`` verbatim. The avatar never infers a state and
/// this model never re-dresses the tool list — both rules are the contract.
@MainActor
@Observable
public final class GuideModel {

    // MARK: Configuration

    public let client: GuideClient
    public internal(set) var projection: GuideProjection?
    public internal(set) var consent: TelemetryConsent?
    public internal(set) var inventory: ToolInventory?

    // MARK: Live state

    /// Mirrors the SSE `state` events — and the session's state — exactly.
    /// The setter is internal so tests can place the machine on any state.
    public internal(set) var state: GuideState = .offline

    /// The active interaction mode. Starts at the projection's resolved
    /// default once loaded.
    public var mode: GuideMode = .text

    public private(set) var entries: [GuideTranscriptEntry] = []

    /// A turn is being streamed; the composer disables while true.
    public private(set) var turnInFlight = false

    /// Set when `GET /transcript` answered 501: the guide keeps its history
    /// client-side. Surfaced, not swallowed — it is not an empty transcript
    /// and must not look like one.
    public private(set) var transcriptNotBackendStored = false

    /// The last failure worth showing in the panel (transport, 5xx, a terminal
    /// `error` event, the premature-close case).
    public private(set) var lastError: String?

    /// Queued tool confirmations (from `confirm: true` tools).
    public let approvals = ToolApprovalQueue()

    private var session: GuideSession?
    private let transcriptStore: any TranscriptStoring
    private let voiceHost: VoiceAdapterHost

    public init(
        client: GuideClient,
        transcriptStore: any TranscriptStoring = InMemoryTranscriptStore(),
        voiceHost: VoiceAdapterHost = VoiceAdapterHost()
    ) {
        self.client = client
        self.transcriptStore = transcriptStore
        self.voiceHost = voiceHost
    }

    /// Seeds the panel from data the host already holds — for previews,
    /// catalogs, and embedders that fetched the projection themselves.
    /// Contract-safe: after construction the state machine still advances
    /// only through the same code paths the SSE events drive.
    public convenience init(
        client: GuideClient,
        seedProjection: GuideProjection?,
        seedConsent: TelemetryConsent?,
        seedInventory: ToolInventory?
    ) {
        self.init(client: client)
        self.projection = seedProjection
        self.consent = seedConsent
        self.inventory = seedInventory
        if seedProjection != nil {
            mode = seedProjection!.resolvedDefaultMode
            state = .idle
        }
    }

    // MARK: Lifecycle

    /// Loads everything the panel needs to render. Safe to call again; each
    /// fetch is independent.
    public func load() async {
        do {
            let projection = try await client.guide()
            self.projection = projection
            mode = projection.resolvedDefaultMode
            state = .idle
        } catch {
            lastError = error.localizedDescription
            state = .offline
        }
        // Consent and inventory failures must not blank the panel: they have
        // their own surface (toggle hidden, degraded banner).
        consent = try? await client.telemetryConsent()
        inventory = try? await client.tools()
    }

    /// Loads backend-stored history when the guide declares the `backend`
    /// store. A 501 flips ``transcriptNotBackendStored`` instead of reading as
    /// an empty transcript.
    public func loadTranscript() async {
        guard let session else { return }
        do {
            let page = try await client.transcript(sessionID: session.id)
            entries = page.turns.map { turn in
                GuideTranscriptEntry(
                    speaker: turn.role == .user ? .user : .assistant,
                    text: turn.content
                )
            }
            transcriptNotBackendStored = false
        } catch is CancellationError {
            // Shutting down; nothing to report.
        } catch ToborError.transcriptNotBackendStored {
            transcriptNotBackendStored = true
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Opens the conversation session.
    public func openSession(locale: String = "en-US") async {
        do {
            session = try await client.createSession(CreateSessionRequest(locale: locale))
            state = session?.state ?? .idle
        } catch {
            lastError = error.localizedDescription
            state = .offline
        }
    }

    // MARK: Turns

    /// Sends one user turn and consumes the SSE stream.
    ///
    /// The stream's terminal `error` event lands in ``lastError`` and the
    /// state machine, not as a thrown error — it is an outcome the panel
    /// renders. Only genuine faults (transport, 409 mid-flight, premature
    /// close) throw.
    public func send(_ text: String, taskID: String? = nil) async throws {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !turnInFlight else { return }
        guard let session else {
            throw ToborError.notAuthenticated
        }

        entries.append(GuideTranscriptEntry(speaker: .user, text: trimmed))
        try? transcriptStore.append(
            Turn(id: UUID(), role: .user, content: trimmed, createdAt: Date())
        )

        turnInFlight = true
        defer { turnInFlight = false }

        var streamingEntry: GuideTranscriptEntry?
        let request = CreateTurnRequest(input: trimmed, taskID: taskID)

        do {
            let stream = try await client.turn(sessionID: session.id, request)
            for try await event in stream {
                switch event {
                case .state(let newState):
                    state = newState
                case .delta(let text):
                    if streamingEntry == nil {
                        streamingEntry = GuideTranscriptEntry(speaker: .assistant, text: text)
                        entries.append(streamingEntry!)
                    } else if let index = entries.lastIndex(where: { $0.id == streamingEntry?.id }) {
                        entries[index].text += text
                    }
                case .toolCall(let id, let name, let args):
                    let summary = args?.stringValue ?? name
                    entries.append(GuideTranscriptEntry(speaker: .toolCall, text: summary))
                    _ = id
                case .toolResult(let id, let ok, let summary):
                    entries.append(GuideTranscriptEntry(
                        speaker: .toolResult,
                        text: summary ?? (ok ? "done" : "failed")
                    ))
                    _ = id
                case .message(let turn):
                    // Replace the streamed partial with the canonical turn.
                    if let streamingEntry, let index = entries.lastIndex(where: { $0.id == streamingEntry.id }) {
                        entries[index].text = turn.content
                    } else {
                        entries.append(GuideTranscriptEntry(speaker: .assistant, text: turn.content))
                    }
                    streamingEntry = nil
                    try? transcriptStore.append(turn)
                case .error(let apiError):
                    lastError = apiError.message
                    state = .error
                }
            }
            if state.isBusy { state = .idle }
        } catch let error as ToborError {
            switch error {
            case .turnInFlight:
                // A turn is already running server-side; do not double-post.
                lastError = error.localizedDescription
            case .streamEndedPrematurely:
                lastError = error.localizedDescription
                state = .error
            default:
                lastError = error.localizedDescription
                state = .error
            }
        } catch {
            lastError = error.localizedDescription
            state = .error
        }
    }

    // MARK: Telemetry

    /// Whether the toggle may render at all. `forced` consent (or a server
    /// that says `user_overridable: false`) renders nothing — and a `PUT`
    /// against such a guide answers 403.
    public var showsTelemetryToggle: Bool {
        consent?.isTogglePresentable ?? projection?.telemetry.userOverridable ?? false
    }

    /// Records the user's preference. - Throws: passes ``ToborError/
    /// telemetryNotOverridable`` through; reaching it means a toggle was on
    /// screen that should not have been.
    public func setTelemetry(enabled: Bool) async throws {
        consent = try await client.setTelemetryConsent(enabled: enabled)
    }

    // MARK: Tools

    public func refreshTools() async {
        inventory = try? await client.tools(refresh: true)
    }

    // MARK: Voice

    public func startVoice() async throws {
        try await voiceHost.start(client: client)
    }

    public func stopVoice() async {
        await voiceHost.stop()
    }
}

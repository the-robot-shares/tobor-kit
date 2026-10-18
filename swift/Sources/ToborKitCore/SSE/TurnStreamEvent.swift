import Foundation

/// The six event names `POST /sessions/{id}/turn` is allowed to emit.
public enum TurnStreamEvent: Sendable, Hashable {

    /// Drives the avatar. The whole point of the event is that the client never
    /// has to infer a state.
    case state(GuideState)

    /// Incremental assistant text. Append; do not replace.
    case delta(String)

    /// A tool invocation started. `args` is present only when argument capture
    /// is enabled by telemetry consent.
    case toolCall(id: String, name: String, args: JSONValue?)

    case toolResult(id: String, ok: Bool, summary: String?)

    /// Terminal. The complete assistant turn.
    case message(Turn)

    /// Terminal. The turn failed.
    case error(GuideAPIError)

    /// Whether this event ends the stream. The contract guarantees exactly one.
    public var isTerminal: Bool {
        switch self {
        case .message, .error: return true
        case .state, .delta, .toolCall, .toolResult: return false
        }
    }
}

/// Turns raw SSE frames into contract events, and enforces the one rule the
/// contract makes about the stream as a whole: it terminates with exactly one
/// `message` or one `error`.
///
/// That rule is worth enforcing here rather than trusting it, because the
/// failure it guards against — a connection dropped mid-answer — looks
/// identical to a successful short answer if nobody checks.
public struct TurnStreamAssembler: Sendable {

    private var parser = SSEParser()
    private(set) public var terminalEvent: TurnStreamEvent?

    public init() {}

    public var sawTerminal: Bool { terminalEvent != nil }

    /// Decodes the events completed by this chunk.
    ///
    /// Frames after a terminal event are discarded: the contract says there are
    /// none, and acting on them would let a malformed stream drive the UI past
    /// the end of a turn.
    public mutating func consume(_ chunk: Data) -> [TurnStreamEvent] {
        guard !sawTerminal else { _ = parser.consume(chunk); return [] }
        return decode(parser.consume(chunk))
    }

    /// Call when the body is exhausted.
    ///
    /// - Throws: ``ToborError/streamEndedPrematurely`` when no terminal event
    ///   ever arrived.
    public mutating func finish() throws -> [TurnStreamEvent] {
        let trailing = sawTerminal ? [] : decode(parser.finish())
        guard sawTerminal else { throw ToborError.streamEndedPrematurely }
        return trailing
    }

    private mutating func decode(_ frames: [ServerSentEvent]) -> [TurnStreamEvent] {
        var out: [TurnStreamEvent] = []
        for frame in frames {
            guard !sawTerminal else { break }
            guard let event = Self.decode(frame) else { continue }
            out.append(event)
            if event.isTerminal { terminalEvent = event }
        }
        return out
    }

    /// - Returns: `nil` for an event name this build does not know, or a frame
    ///   whose payload does not decode. Both are skipped rather than fatal:
    ///   a stream that grows a seventh event name must not break a shipped app.
    public static func decode(_ frame: ServerSentEvent) -> TurnStreamEvent? {
        let data = Data(frame.data.utf8)
        switch frame.event {
        case "state":
            guard let payload = try? ToborJSON.decode(StatePayload.self, from: data) else { return nil }
            return .state(payload.state)
        case "delta":
            guard let payload = try? ToborJSON.decode(DeltaPayload.self, from: data) else { return nil }
            return .delta(payload.text)
        case "tool_call":
            guard let payload = try? ToborJSON.decode(ToolCallPayload.self, from: data) else { return nil }
            return .toolCall(id: payload.id, name: payload.name, args: payload.args)
        case "tool_result":
            guard let payload = try? ToborJSON.decode(ToolResultPayload.self, from: data) else { return nil }
            return .toolResult(id: payload.id, ok: payload.ok, summary: payload.summary)
        case "message":
            guard let turn = try? ToborJSON.decode(Turn.self, from: data) else { return nil }
            return .message(turn)
        case "error":
            guard let error = try? ToborJSON.decode(GuideAPIError.self, from: data) else { return nil }
            return .error(error)
        default:
            return nil
        }
    }

    // MARK: - Wire shapes

    private struct StatePayload: Decodable { let state: GuideState }
    private struct DeltaPayload: Decodable { let text: String }
    private struct ToolCallPayload: Decodable {
        let id: String
        let name: String
        let args: JSONValue?
    }
    private struct ToolResultPayload: Decodable {
        let id: String
        let ok: Bool
        let summary: String?
    }
}

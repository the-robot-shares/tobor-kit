import Foundation

/// One dispatched Server-Sent Event.
public struct ServerSentEvent: Sendable, Hashable {
    /// The `event:` field, or `"message"` when the stream omitted one — the
    /// default the SSE spec mandates.
    public var event: String
    /// `data:` lines joined with `\n`, per the spec.
    public var data: String
    public var id: String?
    public var retry: Int?

    public init(event: String = "message", data: String = "", id: String? = nil, retry: Int? = nil) {
        self.event = event
        self.data = data
        self.id = id
        self.retry = retry
    }
}

/// An incremental `text/event-stream` parser.
///
/// Incremental because network chunk boundaries have nothing to do with event
/// boundaries: a single `data:` line routinely arrives split across two reads,
/// and a parser that assumed otherwise would drop or corrupt exactly the long
/// assistant deltas that matter most.
///
/// Deliberately pure — no networking, no concurrency — so every event shape in
/// the contract can be exercised by feeding it bytes.
public struct SSEParser: Sendable {

    private var pending = Data()
    private var event: String?
    private var dataLines: [String] = []
    private var id: String?
    private var retry: Int?

    public init() {}

    /// Feeds a chunk and returns whatever events completed inside it.
    public mutating func consume(_ chunk: Data) -> [ServerSentEvent] {
        pending.append(chunk)
        var out: [ServerSentEvent] = []

        while let newline = pending.firstIndex(of: 0x0A) {
            let lineData = pending[pending.startIndex..<newline]
            pending = pending[pending.index(after: newline)...]
            // Re-base so `firstIndex` keeps working against a fresh slice.
            pending = Data(pending)

            var line = String(decoding: lineData, as: UTF8.self)
            if line.hasSuffix("\r") { line.removeLast() }

            if let dispatched = handle(line: line) {
                out.append(dispatched)
            }
        }
        return out
    }

    /// Flushes a final event that the stream ended without a blank line after.
    ///
    /// Tolerated rather than rejected: a server that closes the connection
    /// immediately after its last `data:` line is common enough, and the
    /// contract's terminal-event rule is enforced a layer up where the *kind*
    /// of the last event is known.
    public mutating func finish() -> [ServerSentEvent] {
        var out: [ServerSentEvent] = []
        if !pending.isEmpty {
            var line = String(decoding: pending, as: UTF8.self)
            if line.hasSuffix("\r") { line.removeLast() }
            pending.removeAll()
            if let dispatched = handle(line: line) { out.append(dispatched) }
        }
        if let dispatched = dispatch() { out.append(dispatched) }
        return out
    }

    private mutating func handle(line: String) -> ServerSentEvent? {
        if line.isEmpty { return dispatch() }
        // A line starting with ':' is a comment — heartbeats arrive this way.
        if line.hasPrefix(":") { return nil }

        let field: String
        var value: String
        if let colon = line.firstIndex(of: ":") {
            field = String(line[line.startIndex..<colon])
            value = String(line[line.index(after: colon)...])
            if value.hasPrefix(" ") { value.removeFirst() }
        } else {
            field = line
            value = ""
        }

        switch field {
        case "event": event = value
        case "data": dataLines.append(value)
        case "id": id = value
        case "retry": retry = Int(value)
        default: break  // Unknown fields are ignored, per the spec.
        }
        return nil
    }

    private mutating func dispatch() -> ServerSentEvent? {
        defer {
            event = nil
            dataLines.removeAll()
            id = nil
            retry = nil
        }
        // A blank line with nothing buffered dispatches nothing.
        guard !dataLines.isEmpty || event != nil else { return nil }
        return ServerSentEvent(
            event: event ?? "message",
            data: dataLines.joined(separator: "\n"),
            id: id,
            retry: retry
        )
    }
}

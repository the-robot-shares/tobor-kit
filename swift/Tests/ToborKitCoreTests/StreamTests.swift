import XCTest
@testable import ToborKitCore

final class SSEParserTests: XCTestCase {

    private func parse(_ text: String) -> [ServerSentEvent] {
        var parser = SSEParser()
        var events = parser.consume(Data(text.utf8))
        events.append(contentsOf: parser.finish())
        return events
    }

    func testSingleEvent() {
        let events = parse("event: state\ndata: {\"state\":\"thinking\"}\n\n")
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].event, "state")
        XCTAssertEqual(events[0].data, "{\"state\":\"thinking\"}")
    }

    func testOmittedEventNameDefaultsToMessage() {
        let events = parse("data: hello\n\n")
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].event, "message")
        XCTAssertEqual(events[0].data, "hello")
    }

    func testMultilineDataJoinsWithNewlines() {
        let events = parse("data: line one\ndata: line two\n\n")
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].data, "line one\nline two")
    }

    func testChunkBoundariesAreIrrelevant() {
        // A long data line split at every byte position must produce exactly
        // the same event as an unsplit one.
        let line = String(repeating: "x", count: 500) + "end"
        let whole = parse("data: \(line)\n\n")

        var parser = SSEParser()
        var split: [ServerSentEvent] = []
        for byte in Data("data: \(line)\n\n".utf8) {
            split.append(contentsOf: parser.consume(Data([byte])))
        }
        split.append(contentsOf: parser.finish())

        XCTAssertEqual(split.count, 1)
        XCTAssertEqual(split[0].data, whole[0].data)
        XCTAssertEqual(split[0].data, line)
    }

    func testCRLFLineEndings() {
        let events = parse("event: delta\r\ndata: hi\r\n\r\n")
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].data, "hi")
    }

    func testCommentsAreIgnored() {
        let events = parse(": heartbeat\ndata: real\n\n")
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].data, "real")
    }

    func testIDAndRetryCaptured() {
        let events = parse("id: 42\nretry: 2500\ndata: x\n\n")
        XCTAssertEqual(events[0].id, "42")
        XCTAssertEqual(events[0].retry, 2500)
    }

    func testStreamEndingWithoutBlankLineStillDispatches() {
        var parser = SSEParser()
        var events = parser.consume(Data("event: message\ndata: {}".utf8))
        XCTAssertTrue(events.isEmpty)
        events = parser.finish()
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].event, "message")
    }

    func testBlankLineWithNothingBufferedDispatchesNothing() {
        let events = parse("\n\n\n")
        XCTAssertTrue(events.isEmpty)
    }

    func testUnknownFieldsIgnored() {
        let events = parse("event: state\nexpectation: none\ndata: {}\n\n")
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].event, "state")
    }
}

final class TurnStreamAssemblerTests: XCTestCase {

    private func assemble(_ body: Data, enforceTerminal: Bool = true) throws -> [TurnStreamEvent] {
        var assembler = TurnStreamAssembler()
        var out = assembler.consume(body)
        if enforceTerminal {
            out.append(contentsOf: try assembler.finish())
        }
        return out
    }

    func testStateEvent() throws {
        let events = try assemble(MockTransport.sse(("state", #"{"state":"tool_running"}"#)), enforceTerminal: false)
        XCTAssertEqual(events, [.state(.toolRunning)])
    }

    func testDeltaEvent() throws {
        let events = try assemble(MockTransport.sse(("delta", #"{"text":"Hello"}"#)), enforceTerminal: false)
        XCTAssertEqual(events, [.delta("Hello")])
    }

    func testToolCallEventWithAndWithoutArgs() throws {
        var events = try assemble(MockTransport.sse(
            ("tool_call", #"{"id":"t1","name":"Github.PullCreate","args":{"title":"x"}}"#)
        ), enforceTerminal: false)
        XCTAssertEqual(events[0], .toolCall(id: "t1", name: "Github.PullCreate", args: .object(["title": .string("x")])))

        events = try assemble(MockTransport.sse(("tool_call", #"{"id":"t2","name":"Tool.Plain"}"#)), enforceTerminal: false)
        XCTAssertEqual(events[0], .toolCall(id: "t2", name: "Tool.Plain", args: nil))
    }

    func testToolResultEvent() throws {
        let events = try assemble(MockTransport.sse(
            ("tool_result", #"{"id":"t1","ok":true,"summary":"PR opened"}"#)
        ), enforceTerminal: false)
        XCTAssertEqual(events[0], .toolResult(id: "t1", ok: true, summary: "PR opened"))
    }

    func testMessageEventIsTerminal() throws {
        let turn = """
        {"id":"\(UUID().uuidString)","role":"assistant","content":"done","created_at":"2026-08-31T12:00:00Z"}
        """
        let events = try assemble(MockTransport.sse(("message", turn)))
        guard case .message(let decoded) = events[0] else {
            return XCTFail("expected message")
        }
        XCTAssertEqual(decoded.content, "done")
        XCTAssertTrue(events[0].isTerminal)
    }

    func testErrorEventIsTerminal() throws {
        let events = try assemble(MockTransport.sse(
            ("error", #"{"code":"rate_limited","message":"slow down"}"#)
        ))
        XCTAssertEqual(events[0], .error(GuideAPIError(code: "rate_limited", message: "slow down")))
        XCTAssertTrue(events[0].isTerminal)
    }

    func testFullTurnSequence() throws {
        let turn = """
        {"id":"\(UUID().uuidString)","role":"assistant","content":"Done.","created_at":"2026-08-31T12:00:00Z"}
        """
        let events = try assemble(MockTransport.sse(
            ("state", #"{"state":"thinking"}"#),
            ("state", #"{"state":"tool_running"}"#),
            ("tool_call", #"{"id":"t1","name":"Session.Create"}"#),
            ("tool_result", #"{"id":"t1","ok":true,"summary":"created"}"#),
            ("state", #"{"state":"speaking"}"#),
            ("delta", #"{"text":"Done."}"#),
            ("message", turn)
        ))
        XCTAssertEqual(events.count, 7)
        XCTAssertEqual(events[0], .state(.thinking))
        XCTAssertEqual(events[4], .state(.speaking))
        XCTAssertTrue(events.last!.isTerminal)
    }

    func testPrematureCloseThrows() {
        var assembler = TurnStreamAssembler()
        _ = assembler.consume(MockTransport.sse(("state", #"{"state":"thinking"}"#)))
        XCTAssertThrowsError(try assembler.finish()) { error in
            XCTAssertEqual(error as? ToborError, .streamEndedPrematurely)
        }
    }

    func testFramesAfterTerminalAreDiscarded() throws {
        let turn = """
        {"id":"\(UUID().uuidString)","role":"assistant","content":"first","created_at":"2026-08-31T12:00:00Z"}
        """
        var assembler = TurnStreamAssembler()
        _ = assembler.consume(MockTransport.sse(("message", turn)))
        let second = assembler.consume(MockTransport.sse(("delta", #"{"text":"junk"}"#)))
        XCTAssertTrue(second.isEmpty)
        XCTAssertTrue(try assembler.finish().isEmpty)
    }

    func testUnknownEventNameIsSkipped() throws {
        // A seventh event name in some future server must not break this build.
        let turn = """
        {"id":"\(UUID().uuidString)","role":"assistant","content":"ok","created_at":"2026-08-31T12:00:00Z"}
        """
        let events = try assemble(MockTransport.sse(
            ("vibe", #"{"mood":"immaculate"}"#),
            ("message", turn)
        ))
        XCTAssertEqual(events.count, 1)
        guard case .message = events[0] else { return XCTFail("expected message") }
    }

    func testUndecodablePayloadIsSkipped() throws {
        let turn = """
        {"id":"\(UUID().uuidString)","role":"assistant","content":"ok","created_at":"2026-08-31T12:00:00Z"}
        """
        let events = try assemble(MockTransport.sse(
            ("state", #"{"state":"vibing"}"#),   // not a canonical state
            ("delta", "not json"),
            ("message", turn)
        ))
        XCTAssertEqual(events.count, 1)
        guard case .message = events[0] else { return XCTFail("expected only the message") }
    }
}

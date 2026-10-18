import XCTest
@testable import ToborKitCore

final class GuideClientTests: XCTestCase {

    private let baseURL = URL(string: "https://example.test/api/tobor-kit")!

    private func client(_ transport: MockTransport) -> GuideClient {
        GuideClient(baseURL: baseURL, transport: transport)
    }

    // MARK: Transcript — 501 is not empty

    func testTranscriptEmptyPageIsAValue() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(#"{"turns": [], "has_more": false}"#.utf8))
        let page = try await client(transport).transcript(sessionID: UUID())
        XCTAssertTrue(page.turns.isEmpty)
        XCTAssertFalse(page.hasMore)
    }

    func testTranscript501IsDistinctFromEmpty() async {
        // The whole point of the 501: a misconfigured client fails loudly
        // instead of silently showing "no messages".
        let transport = MockTransport()
        transport.enqueue(status: 501)
        do {
            _ = try await client(transport).transcript(sessionID: UUID())
            XCTFail("expected transcriptNotBackendStored")
        } catch {
            XCTAssertEqual(error as? ToborError, .transcriptNotBackendStored)
        }
    }

    func testDeleteTranscript501() async {
        let transport = MockTransport()
        transport.enqueue(status: 501)
        do {
            try await client(transport).deleteTranscript(sessionID: UUID())
            XCTFail("expected transcriptNotBackendStored")
        } catch {
            XCTAssertEqual(error as? ToborError, .transcriptNotBackendStored)
        }
    }

    func testTranscript429CarriesRetryAfter() async {
        let transport = MockTransport()
        transport.enqueue(status: 429, headers: ["Retry-After": "7"])
        do {
            _ = try await client(transport).transcript(sessionID: UUID())
            XCTFail("expected rateLimited")
        } catch {
            XCTAssertEqual(error as? ToborError, .rateLimited(retryAfter: 7))
        }
    }

    // MARK: Voice — 409 is the expected answer for `native`

    func testVoiceToken409MeansNotRequired() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 409)
        let outcome = try await client(transport).mintVoiceToken()
        XCTAssertEqual(outcome, .notRequired)
    }

    func testVoiceToken503MeansUnavailable() async {
        let transport = MockTransport()
        transport.enqueue(status: 503)
        do {
            _ = try await client(transport).mintVoiceToken()
            XCTFail("expected voiceUnavailable")
        } catch {
            XCTAssertEqual(error as? ToborError, .voiceUnavailable)
        }
    }

    func testVoiceTokenMinted() async throws {
        let transport = MockTransport()
        transport.enqueue(
            status: 201,
            body: Data(#"""
                {"adapter": "realtime", "expires_at": "2026-08-31T12:05:00Z",
                 "realtime": {"token": "ek_short"}}
                """#.utf8)
        )
        let outcome = try await client(transport).mintVoiceToken()
        guard case .minted(let credential) = outcome else {
            return XCTFail("expected minted")
        }
        XCTAssertEqual(credential.realtime?.token, "ek_short")
    }

    // MARK: Telemetry — 403 means the toggle should not have been there

    func testSetTelemetry403ThrowsNotOverridable() async {
        let transport = MockTransport()
        transport.enqueue(status: 403)
        do {
            _ = try await client(transport).setTelemetryConsent(enabled: false)
            XCTFail("expected telemetryNotOverridable")
        } catch {
            XCTAssertEqual(error as? ToborError, .telemetryNotOverridable)
        }
    }

    func testSetTelemetrySendsEnabledFlag() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(
            #"{"enabled": false, "source": "user", "user_overridable": true}"#.utf8
        ))
        let consent = try await client(transport).setTelemetryConsent(enabled: false)
        XCTAssertEqual(consent.source, .user)
        let body = String(decoding: transport.lastBody ?? Data(), as: UTF8.self)
        XCTAssertTrue(body.contains(#""enabled":false"#))
    }

    // MARK: mcp/tools

    func testTools502MeansRequiredServerUnreachable() async {
        let transport = MockTransport()
        transport.enqueue(status: 502)
        do {
            _ = try await client(transport).tools()
            XCTFail("expected requiredToolServerUnreachable")
        } catch {
            XCTAssertEqual(error as? ToborError, .requiredToolServerUnreachable)
        }
    }

    func testToolsRefreshQuery() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(#"{"groups": [], "tools": []}"#.utf8))
        _ = try await client(transport).tools(refresh: true)
        let url = transport.recordedRequests[0].url!
        XCTAssertTrue(url.query?.contains("refresh=true") ?? false)
    }

    // MARK: guide

    func testGuideEndpointIsUnauthenticated() async throws {
        // security: [] on GET /guide — the client must not attach a token,
        // and must not even consult the auth provider for it.
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(
            #"{"slug": "s", "name": "n", "modes": [], "ui": {}, "auth": {}, "telemetry": {}, "voice": {}, "transcript": {}}"#.utf8
        ))
        nonisolated(unsafe) var consulted = false
        let auth = ClosureAuth { consulted = true; return "secret" }
        _ = try await GuideClient(baseURL: baseURL, transport: transport, auth: auth).guide()
        XCTAssertFalse(consulted)
        XCTAssertNil(transport.recordedRequests[0].value(forHTTPHeaderField: "Authorization"))
        XCTAssertTrue(transport.recordedRequests[0].url!.path.hasSuffix("/guide"))
    }

    func testAuthenticatedEndpointCarriesBearerToken() async throws {
        let transport = MockTransport()
        transport.enqueue(status: 200, body: Data(
            #"{"id": "\#(UUID().uuidString)", "created_at": "2026-08-31T12:00:00Z", "state": "idle"}"#.utf8
        ))
        let auth = StaticAuth(bearerToken: "secret")
        _ = try await GuideClient(baseURL: baseURL, transport: transport, auth: auth).createSession()
        XCTAssertEqual(
            transport.recordedRequests[0].value(forHTTPHeaderField: "Authorization"),
            "Bearer secret"
        )
    }

    // MARK: Turn streaming

    func testTurnStreamsEvents() async throws {
        let sessionID = UUID()
        let terminal = """
        {"id":"\(UUID().uuidString)","role":"assistant","content":"Done.","created_at":"2026-08-31T12:00:00Z"}
        """
        let body = MockTransport.sse(
            ("state", #"{"state":"thinking"}"#),
            ("delta", #"{"text":"Done."}"#),
            ("message", terminal)
        )

        let transport = MockTransport()
        transport.streamHandler = { request in
            let stream = AsyncThrowingStream<Data, any Error> { continuation in
                continuation.yield(body)
                continuation.finish()
            }
            return (stream, MockTransport.response(status: 200, request: request.url))
        }

        let stream = try await client(transport).turn(
            sessionID: sessionID,
            CreateTurnRequest(input: "hi")
        )
        var events: [TurnStreamEvent] = []
        for try await event in stream { events.append(event) }
        XCTAssertEqual(events.count, 3)
        guard case .message(let turn) = events.last else { return XCTFail("expected terminal message") }
        XCTAssertEqual(turn.content, "Done.")
        XCTAssertTrue(transport.recordedRequests[0].url!.path.contains("/turn"))
        XCTAssertEqual(transport.recordedRequests[0].value(forHTTPHeaderField: "Accept"), "text/event-stream")
    }

    func testTurn409ThrowsTurnInFlight() async {
        let transport = MockTransport()
        transport.streamHandler = { request in
            let stream = AsyncThrowingStream<Data, any Error> { $0.finish() }
            return (stream, MockTransport.response(status: 409, request: request.url))
        }
        do {
            _ = try await client(transport).turn(
                sessionID: UUID(),
                CreateTurnRequest(input: "hi")
            )
            XCTFail("expected turnInFlight")
        } catch {
            XCTAssertEqual(error as? ToborError, .turnInFlight)
        }
    }

    func testTurnPrematureCloseThrows() async throws {
        let transport = MockTransport()
        transport.streamHandler = { request in
            let stream = AsyncThrowingStream<Data, any Error> { continuation in
                // States only — no terminal event, then the socket closes.
                continuation.yield(MockTransport.sse(("state", #"{"state":"thinking"}"#)))
                continuation.finish()
            }
            return (stream, MockTransport.response(status: 200, request: request.url))
        }
        let stream = try await client(transport).turn(
            sessionID: UUID(),
            CreateTurnRequest(input: "hi")
        )
        do {
            for try await _ in stream {}
            XCTFail("expected streamEndedPrematurely")
        } catch let error as ToborError {
            XCTAssertEqual(error, .streamEndedPrematurely)
        }
    }
}

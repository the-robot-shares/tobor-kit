import Foundation

/// The whole client surface of `tobor-kit.openapi.yaml`, and nothing else.
///
/// Every method here maps to one `operationId`. There is no convenience method
/// that synthesises a call the contract does not describe, and no client-side
/// re-dressing of anything the server already dressed.
public struct GuideClient: Sendable {

    /// Base URL including the mount, e.g. `https://example.com/api/tobor-kit`.
    public let baseURL: URL
    private let transport: any HTTPTransporting
    private let auth: (any AuthProviding)?

    public init(
        baseURL: URL,
        transport: any HTTPTransporting = URLSessionTransport(),
        auth: (any AuthProviding)? = nil
    ) {
        self.baseURL = baseURL
        self.transport = transport
        self.auth = auth
    }

    // MARK: - guide

    /// `GET /guide`. Unauthenticated by contract (`security: []`).
    public func guide() async throws -> GuideProjection {
        let (data, response) = try await send(request(path: "/guide", authenticated: false))
        try check(response, data: data)
        return try decode(GuideProjection.self, data)
    }

    // MARK: - session

    public func createSession(_ body: CreateSessionRequest = .init()) async throws -> GuideSession {
        var req = request(path: "/sessions", method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try ToborJSON.encode(body)
        let (data, response) = try await send(req)
        try check(response, data: data)
        return try decode(GuideSession.self, data)
    }

    public func session(id: UUID) async throws -> GuideSession {
        let (data, response) = try await send(request(path: "/sessions/\(id.uuidString)"))
        try check(response, data: data)
        return try decode(GuideSession.self, data)
    }

    public func endSession(id: UUID) async throws {
        let (data, response) = try await send(request(path: "/sessions/\(id.uuidString)", method: "DELETE"))
        try check(response, data: data)
    }

    // MARK: - turn

    /// `POST /sessions/{sessionId}/turn`, streamed.
    ///
    /// The returned sequence yields every contract event in order, including
    /// the terminal `message` or `error` — an `error` event is a *value*, not a
    /// thrown error, because it is a normal outcome the panel renders.
    ///
    /// It throws only for things that are genuinely wrong: a non-200 status, a
    /// transport failure, or a body that ended without a terminal event
    /// (``ToborError/streamEndedPrematurely``).
    public func turn(
        sessionID: UUID,
        _ body: CreateTurnRequest
    ) async throws -> AsyncThrowingStream<TurnStreamEvent, any Error> {
        var req = request(path: "/sessions/\(sessionID.uuidString)/turn", method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        req.httpBody = try ToborJSON.encode(body)
        try await applyAuth(&req)

        let (chunks, response) = try await transport.stream(req)
        if response.statusCode == 409 { throw ToborError.turnInFlight }
        guard response.statusCode == 200 else {
            // The body is the error payload rather than a stream; it has not
            // been read yet, so report what the status alone supports.
            throw mapStatus(response, error: nil)
        }

        return AsyncThrowingStream { continuation in
            let task = Task {
                var assembler = TurnStreamAssembler()
                do {
                    for try await chunk in chunks {
                        for event in assembler.consume(chunk) {
                            continuation.yield(event)
                        }
                        if assembler.sawTerminal { break }
                    }
                    for event in try assembler.finish() {
                        continuation.yield(event)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: - mcp

    /// `GET /mcp/tools`. Render the result verbatim — the `mcp.menu` overlay is
    /// already applied server-side, and re-applying it here is the drift this
    /// kit exists to prevent.
    public func tools(refresh: Bool = false) async throws -> ToolInventory {
        var items: [URLQueryItem] = []
        if refresh { items.append(URLQueryItem(name: "refresh", value: "true")) }
        let (data, response) = try await send(request(path: "/mcp/tools", query: items))
        if response.statusCode == 502 { throw ToborError.requiredToolServerUnreachable }
        try check(response, data: data)
        return try decode(ToolInventory.self, data)
    }

    // MARK: - voice

    /// `POST /voice/token`.
    ///
    /// 409 is returned as ``VoiceTokenOutcome/notRequired`` rather than thrown:
    /// for the `native` adapter it is the expected answer, and treating it as a
    /// failure would make a correctly-configured guide look broken.
    public func mintVoiceToken() async throws -> VoiceTokenOutcome {
        let (data, response) = try await send(request(path: "/voice/token", method: "POST"))
        switch response.statusCode {
        case 409: return .notRequired
        case 503: throw ToborError.voiceUnavailable
        default:
            try check(response, data: data)
            return .minted(try decode(VoiceCredential.self, data))
        }
    }

    // MARK: - telemetry

    public func telemetryConsent() async throws -> TelemetryConsent {
        let (data, response) = try await send(request(path: "/telemetry/consent"))
        try check(response, data: data)
        return try decode(TelemetryConsent.self, data)
    }

    /// `PUT /telemetry/consent`.
    ///
    /// - Throws: ``ToborError/telemetryNotOverridable`` on 403. Reaching that
    ///   means a toggle was on screen that ``TelemetryConsent/isTogglePresentable``
    ///   said should not have been.
    @discardableResult
    public func setTelemetryConsent(enabled: Bool) async throws -> TelemetryConsent {
        var req = request(path: "/telemetry/consent", method: "PUT")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try ToborJSON.encode(["enabled": enabled])
        let (data, response) = try await send(req)
        if response.statusCode == 403 { throw ToborError.telemetryNotOverridable }
        try check(response, data: data)
        return try decode(TelemetryConsent.self, data)
    }

    // MARK: - transcript

    /// `GET /sessions/{sessionId}/transcript`.
    ///
    /// - Throws: ``ToborError/transcriptNotBackendStored`` on 501. That is a
    ///   different thing from an empty page and must stay different: a guide
    ///   using the `memory` or `local` store keeps its history client-side, and
    ///   silently showing "no messages" would hide a misconfiguration.
    public func transcript(
        sessionID: UUID,
        limit: Int? = nil,
        before: Date? = nil
    ) async throws -> TranscriptPage {
        var items: [URLQueryItem] = []
        if let limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }
        if let before {
            items.append(URLQueryItem(name: "before", value: ISO8601DateFormatter().string(from: before)))
        }
        let (data, response) = try await send(
            request(path: "/sessions/\(sessionID.uuidString)/transcript", query: items)
        )
        if response.statusCode == 501 { throw ToborError.transcriptNotBackendStored }
        try check(response, data: data)
        return try decode(TranscriptPage.self, data)
    }

    public func deleteTranscript(sessionID: UUID) async throws {
        let (data, response) = try await send(
            request(path: "/sessions/\(sessionID.uuidString)/transcript", method: "DELETE")
        )
        if response.statusCode == 501 { throw ToborError.transcriptNotBackendStored }
        try check(response, data: data)
    }

    // MARK: - Plumbing

    private func request(
        path: String,
        method: String = "GET",
        query: [URLQueryItem] = [],
        authenticated: Bool = true
    ) -> URLRequest {
        var url = baseURL.appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path)
        if !query.isEmpty, var components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            components.queryItems = (components.queryItems ?? []) + query
            url = components.url ?? url
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if !authenticated {
            // Marked so `send` skips the auth provider entirely rather than
            // attaching a token the endpoint declares it does not want.
            req.setValue("1", forHTTPHeaderField: Self.skipAuthHeader)
        }
        return req
    }

    private static let skipAuthHeader = "X-ToborKit-Anonymous"

    private func send(_ original: URLRequest) async throws -> (Data, HTTPURLResponse) {
        var req = original
        if req.value(forHTTPHeaderField: Self.skipAuthHeader) == nil {
            try await applyAuth(&req)
        } else {
            req.setValue(nil, forHTTPHeaderField: Self.skipAuthHeader)
        }
        return try await transport.send(req)
    }

    private func applyAuth(_ req: inout URLRequest) async throws {
        guard let auth, let header = try await auth.authorizationHeader() else { return }
        req.setValue(header, forHTTPHeaderField: "Authorization")
    }

    private func check(_ response: HTTPURLResponse, data: Data) throws {
        guard (200..<300).contains(response.statusCode) else {
            throw mapStatus(response, error: GuideAPIError.extract(from: data))
        }
    }

    private func mapStatus(_ response: HTTPURLResponse, error: GuideAPIError?) -> ToborError {
        switch response.statusCode {
        case 401: return .unauthorized
        case 404: return .notFound
        case 429:
            let after = (response.value(forHTTPHeaderField: "Retry-After")).flatMap(Int.init)
            return .rateLimited(retryAfter: after)
        default: return .http(status: response.statusCode, error: error)
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, _ data: Data) throws -> T {
        do {
            return try ToborJSON.decode(type, from: data)
        } catch {
            throw ToborError.malformedResponse(String(describing: error))
        }
    }
}

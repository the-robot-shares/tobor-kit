import Foundation
import os
import ToborKitCore

/// Scripted HTTP transport: no sockets, no URLProtocol trickery.
final class MockTransport: HTTPTransporting, @unchecked Sendable {

    private struct State: @unchecked Sendable {
        var queue: [@Sendable (URLRequest) throws -> (Data, HTTPURLResponse)] = []
        var requests: [URLRequest] = []
        var bodies: [Data] = []
    }

    private let state = OSAllocatedUnfairLock(initialState: State())

    var streamHandler: (@Sendable (URLRequest) throws -> (
        AsyncThrowingStream<Data, any Error>, HTTPURLResponse
    ))?

    init() {}

    /// Queues a response for the next `send`.
    func enqueue(status: Int, headers: [String: String] = [:], body: Data = Data()) {
        let handler: @Sendable (URLRequest) throws -> (Data, HTTPURLResponse) = { request in
            (body, Self.response(status: status, headers: headers, request: request.url))
        }
        state.withLock { $0.queue.append(handler) }
    }

    /// Queues an arbitrary handler for the next `send`.
    func enqueue(_ handler: @escaping @Sendable (URLRequest) throws -> (Data, HTTPURLResponse)) {
        state.withLock { state in
            state.queue.append(handler)
        }
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        typealias Handler = @Sendable (URLRequest) throws -> (Data, HTTPURLResponse)
        let handler: Handler? = state.withLock { locked -> Handler? in
            locked.requests.append(request)
            locked.bodies.append(request.httpBody ?? Data())
            return locked.queue.isEmpty ? nil : locked.queue.removeFirst()
        }
        guard let handler else {
            throw ToborError.transport("MockTransport ran dry")
        }
        return try handler(request)
    }

    func stream(_ request: URLRequest) async throws -> (AsyncThrowingStream<Data, any Error>, HTTPURLResponse) {
        state.withLock { state in
            state.requests.append(request)
            state.bodies.append(request.httpBody ?? Data())
        }
        if let streamHandler {
            return try streamHandler(request)
        }
        throw ToborError.transport("No stream scripted")
    }

    var requestCount: Int {
        state.withLock { $0.requests.count }
    }

    var lastBody: Data? {
        state.withLock { $0.bodies.last }
    }

    var recordedRequests: [URLRequest] {
        state.withLock { $0.requests }
    }

    static func response(status: Int, headers: [String: String] = [:], request: URL?) -> HTTPURLResponse {
        HTTPURLResponse(
            url: request ?? URL(string: "https://example.test")!,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        )!
    }

    /// Builds an SSE body from `event`/`data` pairs, each frame blank-line
    /// terminated — the wire shape the contract describes.
    static func sse(_ frames: (event: String, data: String)...) -> Data {
        var text = ""
        for frame in frames {
            text += "event: \(frame.event)\ndata: \(frame.data)\n\n"
        }
        return Data(text.utf8)
    }
}

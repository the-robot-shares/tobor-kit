import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// The seam every network call goes through, so the client is testable without
/// a server, a simulator, or `URLProtocol` trickery.
public protocol HTTPTransporting: Sendable {

    /// A complete request/response round trip.
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)

    /// A streaming round trip, for `text/event-stream`.
    ///
    /// The body arrives as `Data` chunks in whatever sizes the network produced
    /// — chunk boundaries are explicitly *not* event boundaries, which is the
    /// whole reason ``SSEParser`` is incremental.
    func stream(_ request: URLRequest) async throws -> (AsyncThrowingStream<Data, any Error>, HTTPURLResponse)
}

public struct URLSessionTransport: HTTPTransporting {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw ToborError.transport("Response was not HTTP")
            }
            return (data, http)
        } catch let error as ToborError {
            throw error
        } catch {
            throw ToborError.transport(error.localizedDescription)
        }
    }

    public func stream(
        _ request: URLRequest
    ) async throws -> (AsyncThrowingStream<Data, any Error>, HTTPURLResponse) {
        let bytes: URLSession.AsyncBytes
        let response: URLResponse
        do {
            (bytes, response) = try await session.bytes(for: request)
        } catch {
            throw ToborError.transport(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw ToborError.transport("Response was not HTTP")
        }

        let stream = AsyncThrowingStream<Data, any Error> { continuation in
            let task = Task {
                do {
                    // `AsyncBytes` yields one byte at a time; re-chunking here
                    // keeps the parser's work proportional to lines rather than
                    // to per-byte continuation hops.
                    var buffer = Data()
                    buffer.reserveCapacity(4096)
                    for try await byte in bytes {
                        buffer.append(byte)
                        if byte == 0x0A || buffer.count >= 4096 {
                            continuation.yield(buffer)
                            buffer.removeAll(keepingCapacity: true)
                        }
                    }
                    if !buffer.isEmpty { continuation.yield(buffer) }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: ToborError.transport(error.localizedDescription))
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
        return (stream, http)
    }
}

/// Supplies the `Authorization` header, when there is one.
///
/// Split out from the auth client so a host app that already has its own
/// session (the common case for an app embedding a guide) can hand ToborKit a
/// closure instead of adopting ToborKit's OIDC flow.
public protocol AuthProviding: Sendable {
    func authorizationHeader() async throws -> String?
}

public struct StaticAuth: AuthProviding {
    private let header: String?

    public init(bearerToken: String?) {
        self.header = bearerToken.map { "Bearer \($0)" }
    }

    public func authorizationHeader() async throws -> String? { header }
}

/// Bridges a host app's existing token source.
public struct ClosureAuth: AuthProviding {
    private let provider: @Sendable () async throws -> String?

    public init(_ provider: @escaping @Sendable () async throws -> String?) {
        self.provider = provider
    }

    public func authorizationHeader() async throws -> String? {
        try await provider().map { "Bearer \($0)" }
    }
}

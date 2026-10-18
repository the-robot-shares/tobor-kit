import Foundation

/// The `Error` schema from the contract.
public struct GuideAPIError: Sendable, Codable, Hashable {
    public var code: String
    public var message: String
    public var detail: [String: JSONValue]?

    public init(code: String, message: String, detail: [String: JSONValue]? = nil) {
        self.code = code
        self.message = message
        self.detail = detail
    }

    /// Best-effort extraction from a response body that may not be an `Error`
    /// at all — an ingress HTML page, an empty body, a proxy's own JSON.
    public static func extract(from data: Data) -> GuideAPIError? {
        try? ToborJSON.decode(GuideAPIError.self, from: data)
    }
}

public enum ToborError: Error, Sendable, Hashable {

    /// The transport itself failed — no HTTP response was produced.
    case transport(String)

    /// A non-2xx response, with whatever the server said about it.
    case http(status: Int, error: GuideAPIError?)

    /// The response was 2xx but the body did not decode.
    case malformedResponse(String)

    /// 404 on a session or transcript.
    case notFound

    /// 401.
    case unauthorized

    /// 429, with the `Retry-After` header when the server sent one.
    case rateLimited(retryAfter: Int?)

    /// 409 on `POST /sessions/{id}/turn` — a turn is already in flight.
    case turnInFlight

    /// 501 on the transcript endpoints. **Not** the same as an empty
    /// transcript: it means this guide uses a client-side store and the caller
    /// asked the wrong side for the history.
    case transcriptNotBackendStored

    /// 403 on `PUT /telemetry/consent` — `telemetry.user_overridable` is false.
    /// Reaching this means a toggle was rendered that should not have been.
    case telemetryNotOverridable

    /// 502 on `GET /mcp/tools` — a `required` MCP server was unreachable.
    case requiredToolServerUnreachable

    /// 503 on `POST /voice/token` — voice is disabled or unconfigured.
    case voiceUnavailable

    /// The SSE stream ended without the `message` or `error` the contract
    /// guarantees.
    case streamEndedPrematurely

    /// The stream carried a terminal `error` event.
    case streamError(GuideAPIError)

    // MARK: - Auth

    case notAuthenticated
    case sessionExpired
    case stateMismatch
    case authorizationExpired
    case oauth(code: String, description: String?)
    case discovery(String)
    case keychain(status: Int32)
}

extension ToborError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .transport(let m): return "Network error: \(m)"
        case .http(let status, let error):
            return error.map { "\($0.code): \($0.message)" } ?? "HTTP \(status)"
        case .malformedResponse(let m): return "Unexpected response: \(m)"
        case .notFound: return "Not found."
        case .unauthorized: return "Sign-in required."
        case .rateLimited(let after):
            return after.map { "Too many requests. Try again in \($0)s." } ?? "Too many requests."
        case .turnInFlight: return "A reply is already in progress."
        case .transcriptNotBackendStored:
            return "This guide keeps its transcript on the device, not on the server."
        case .telemetryNotOverridable:
            return "Telemetry is set by the guide and cannot be changed here."
        case .requiredToolServerUnreachable: return "A required tool server is unreachable."
        case .voiceUnavailable: return "Voice is unavailable for this guide."
        case .streamEndedPrematurely: return "The reply was cut off."
        case .streamError(let e): return e.message
        case .notAuthenticated: return "Not signed in."
        case .sessionExpired: return "Your session expired. Sign in again."
        case .stateMismatch: return "Sign-in could not be verified."
        case .authorizationExpired: return "Sign-in took too long. Try again."
        case .oauth(let code, let description): return description ?? code
        case .discovery(let m): return "Identity provider discovery failed: \(m)"
        case .keychain(let status): return "Keychain error \(status)."
        }
    }
}

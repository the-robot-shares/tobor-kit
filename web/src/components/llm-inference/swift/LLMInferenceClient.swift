import Foundation
import ToborKitCore

/// Error typing for provider calls — maps HTTP status onto what the user
/// can act on (bad key vs bad URL vs throttled), per the settings page's
/// Test Connection box.
public enum LLMInferenceError: Error, Sendable, Equatable {
    /// No key resolved (neither literal nor environment).
    case missingAPIKey(expectedEnvVar: String?)
    /// No base URL — provider needs one and neither config nor catalog has it.
    case missingBaseURL
    /// No model — the provider has only a placeholder (custom), and the
    /// user must type or fetch one.
    case missingModel
    /// 401/403: the key was rejected.
    case unauthorized
    /// 404: wrong base URL path or unknown model.
    case notFound
    /// 429.
    case rateLimited(retryAfterSeconds: Int?)
    case network(String)
    case invalidResponse(String)

    public var userMessage: String {
        switch self {
        case .missingAPIKey(let env):
            return env.map { "No API key — set it in settings or via \($0)." } ?? "No API key — add one in settings."
        case .missingBaseURL:
            return "No base URL — set one in the advanced section."
        case .missingModel:
            return "No model — type one or click \"Fetch models\"."
        case .unauthorized:
            return "Authentication failed — check the API key."
        case .notFound:
            return "Endpoint or model not found — check the base URL and model name."
        case .rateLimited(let seconds):
            return seconds.map { "Rate limited — retry in \($0)s." } ?? "Rate limited — try again shortly."
        case .network(let detail):
            return "Network error: \(detail)"
        case .invalidResponse(let detail):
            return "Unexpected response: \(detail)"
        }
    }
}

/// A completed test round trip: the reply text, the model that answered,
/// and the wall-clock latency of the call.
public struct LLMCompletionReply: Sendable, Hashable {
    public let content: String
    public let model: String
    public let latency: TimeInterval

    public init(content: String, model: String, latency: TimeInterval) {
        self.content = content
        self.model = model
        self.latency = latency
    }
}

/// Non-streaming client for direct provider inference. OpenAI-shaped
/// providers (openai / zai / local / custom-openai) talk `POST {base}
/// /chat/completions` + `GET {base}/models`; Anthropic-shaped ones talk
/// `POST {base}/messages` + `GET {base}/models` with `x-api-key` and
/// `anthropic-version` headers. Every call goes through the shared
/// ``HTTPTransporting`` seam, so tests mock the transport, not the network.
public struct LLMInferenceClient: Sendable {

    private let config: LLMInferenceConfig
    private let catalog: [LLMProvider]
    private let transport: any HTTPTransporting
    private let environment: [String: String]

    public init(
        config: LLMInferenceConfig,
        catalog: [LLMProvider] = LLMProvider.catalog,
        transport: any HTTPTransporting = URLSessionTransport(),
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) {
        self.config = config
        self.catalog = catalog
        self.transport = transport
        self.environment = environment
    }

    // MARK: Completion (the Test Connection round trip)

    /// Sends one user message, non-streaming, and returns the first choice's
    /// text with round-trip latency.
    public func complete(_ prompt: String, maxTokens: Int = 256) async throws -> LLMCompletionReply {
        let base = try requireBaseURL()
        let shape = config.effectiveAPIShape(catalog: catalog)
        let model = try requireModel()

        let url = base.appending(path: shape == .anthropic ? "messages" : "chat/completions")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60
        try applyAuth(to: &request, shape: shape)

        // Both shapes take the same user-message payload here; only the
        // endpoint path and auth headers differ.
        let body = JSONValue.object([
            "model": .string(model),
            "max_tokens": .number(Double(maxTokens)),
            "messages": .array([.object(["role": .string("user"), "content": .string(prompt)])]),
        ])
        request.httpBody = try JSONEncoder().encode(body)

        let start = ContinuousClock.now
        let (data, http) = try await send(request)
        let latency = start.duration(to: .now).secondsValue
        try mapStatus(http, data: data)

        let json = try decodeObject(data)
        let content: String
        if shape == .anthropic {
            // {"content":[{"type":"text","text":"..."}], ...}
            guard case .array(let blocks)? = json["content"] else {
                throw LLMInferenceError.invalidResponse("missing content blocks")
            }
            content = blocks.compactMap { $0["text"]?.stringValue }.joined()
        } else {
            // {"choices":[{"message":{"content":"..."}}]}
            guard case .array(let choices)? = json["choices"],
                  let text = choices.first?["message"]?["content"]?.stringValue else {
                throw LLMInferenceError.invalidResponse("missing choices[0].message.content")
            }
            content = text
        }
        let repliedModel = json["model"]?.stringValue ?? model
        return LLMCompletionReply(content: content, model: repliedModel, latency: latency)
    }

    // MARK: Models listing (Refresh models)

    /// `GET {base}/models` in the provider's shape; returns model ids in
    /// endpoint order. Some OpenAI-compatible endpoints (notably Z.ai) do not
    /// implement the listing — a 404 surfaces as `.notFound` and the UI's
    /// free-text entry stays the path in.
    public func models() async throws -> [String] {
        let base = try requireBaseURL()
        let shape = config.effectiveAPIShape(catalog: catalog)

        var request = URLRequest(url: base.appending(path: "models"))
        request.httpMethod = "GET"
        try applyAuth(to: &request, shape: shape)

        let (data, http) = try await send(request)
        try mapStatus(http, data: data)

        let json = try decodeObject(data)
        guard case .array(let items)? = json["data"] else {
            throw LLMInferenceError.invalidResponse("missing data[]")
        }
        return items.compactMap { $0["id"]?.stringValue }
    }

    // MARK: Plumbing

    private func requireBaseURL() throws -> URL {
        guard let base = config.effectiveBaseURL(catalog: catalog) else {
            throw LLMInferenceError.missingBaseURL
        }
        return base
    }

    /// The model to send; every provider here takes an explicit model name.
    /// The catalog default fills in when the user left the field alone;
    /// placeholder-only providers (custom, "model-name") are an error, not
    /// a 400 from a remote server with an opaque message.
    private func requireModel() throws -> String {
        if let model = config.model, !model.isEmpty { return model }
        if let fallback = LLMProvider.provider(id: config.providerID, in: catalog)?.defaultModel,
           fallback != "model-name" {
            return fallback
        }
        throw LLMInferenceError.missingModel
    }

    /// Sets the auth header from the resolved key spec. A config without an
    /// explicit spec falls back to the provider's env var — the environment
    /// is a first-class key source (llm-toolkit semantics), and the settings
    /// view only surfaces it as a hint. The key exists only here — never
    /// logged, never in error messages.
    private func applyAuth(to request: inout URLRequest, shape: LLMApiShape) throws {
        let provider = LLMProvider.provider(id: config.providerID, in: catalog)
        if provider?.requiresKey != true {
            return // local, no-key endpoints
        }
        let spec = config.apiKey ?? provider?.envVarName.map(LLMKeySpec.environment)
        guard let key = spec?.resolve(environment: environment) else {
            throw LLMInferenceError.missingAPIKey(expectedEnvVar: provider?.envVarName)
        }
        if shape == .anthropic {
            request.setValue(key, forHTTPHeaderField: "x-api-key")
            request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        } else {
            request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        }
    }

    private func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            return try await transport.send(request)
        } catch let error as LLMInferenceError {
            throw error
        } catch {
            throw LLMInferenceError.network(error.localizedDescription)
        }
    }

    private func mapStatus(_ http: HTTPURLResponse, data: Data) throws {
        switch http.statusCode {
        case 200..<300: return
        case 401, 403: throw LLMInferenceError.unauthorized
        case 404: throw LLMInferenceError.notFound
        case 429:
            let retry = http.value(forHTTPHeaderField: "Retry-After").flatMap { Double($0) }.map { Int($0.rounded(.up)) }
            throw LLMInferenceError.rateLimited(retryAfterSeconds: retry)
        default:
            let detail = String(data: data.prefix(300), encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw LLMInferenceError.network(detail)
        }
    }

    private func decodeObject(_ data: Data) throws -> JSONValue {
        let json = try? JSONDecoder().decode(JSONValue.self, from: data)
        guard case .object(let object)? = json else {
            throw LLMInferenceError.invalidResponse("response was not a JSON object")
        }
        return .object(object)
    }
}

extension Duration {
    fileprivate var secondsValue: TimeInterval {
        let (seconds, attoseconds) = self.components
        return Double(seconds) + Double(attoseconds) / 1_000_000_000_000_000_000
    }
}

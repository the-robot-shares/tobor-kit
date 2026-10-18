import Foundation

/// How the API key is supplied. `.environment` resolves at call time —
/// the key never passes through config storage — while `.literal` is a key
/// the user typed into settings. Either way the resolved key is used only in
/// the request header and is never logged.
public enum LLMKeySpec: Sendable, Hashable, Codable {
    /// Resolved from this environment variable when the call is made.
    case environment(name: String)
    /// A key stored in config storage. Hosts that want a hardened path
    /// (Keychain etc.) should prefer `.environment` and resolve elsewhere.
    case literal(String)

    /// Resolves against the given environment. An unset environment
    /// variable yields nil, surfacing as `.missingAPIKey` at call time.
    public func resolve(environment: [String: String]) -> String? {
        switch self {
        case .environment(let name):
            let value = environment[name] ?? ""
            return value.isEmpty ? nil : value
        case .literal(let value):
            return value.isEmpty ? nil : value
        }
    }

    // MARK: Codable — tagged so storage stays unambiguous.

    private enum CodingKeys: String, CodingKey {
        case env, literal
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let name = try container.decodeIfPresent(String.self, forKey: .env) {
            self = .environment(name: name)
        } else if let value = try container.decodeIfPresent(String.self, forKey: .literal) {
            self = .literal(value)
        } else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "LLMKeySpec needs env or literal")
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .environment(let name): try container.encode(name, forKey: .env)
        case .literal(let value): try container.encode(value, forKey: .literal)
        }
    }
}

/// The persisted LLM inference settings — provider, endpoint override, key
/// spec, and selected model. Complements `model-config` (which models the
/// host-app model-config schema); this models direct provider inference.
public struct LLMInferenceConfig: Sendable, Hashable, Codable {
    /// `LLMProvider.id` of the selected provider ("" = none).
    public var providerID: String
    /// Overrides the provider's `defaultBaseURL`. Hosts persist it only when
    /// the user actually typed one; nil defers to the catalog default.
    public var baseURL: URL?
    /// nil = no key supplied at all (fine for `local`).
    public var apiKey: LLMKeySpec?
    public var model: String?
    /// Only meaningful for `custom` (whose shape the catalog cannot pin);
    /// defaults to `.openAI` when nil.
    public var apiShape: LLMApiShape?

    public init(
        providerID: String = "",
        baseURL: URL? = nil,
        apiKey: LLMKeySpec? = nil,
        model: String? = nil,
        apiShape: LLMApiShape? = nil
    ) {
        self.providerID = providerID
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.model = model
        self.apiShape = apiShape
    }

    /// Whether a provider is selected at all (the llm-toolkit "None" option).
    public var isConfigured: Bool { !providerID.isEmpty }

    /// The endpoint requests go to: the override, else the catalog default.
    public func effectiveBaseURL(catalog: [LLMProvider]) -> URL? {
        if let baseURL { return baseURL }
        return LLMProvider.provider(id: providerID, in: catalog)?.defaultBaseURL
    }

    /// The wire shape: the provider's pinned shape wins; the config's
    /// explicit pick only applies to `custom` (whose catalog entry pins
    /// nothing). Defaults to `.openAI` when nothing is pinned.
    public func effectiveAPIShape(catalog: [LLMProvider]) -> LLMApiShape {
        if let pinned = LLMProvider.provider(id: providerID, in: catalog)?.apiShape { return pinned }
        if let apiShape { return apiShape }
        return .openAI
    }

    /// The model to send: the stored selection, else the provider default.
    public func effectiveModel(catalog: [LLMProvider]) -> String? {
        if let model, !model.isEmpty { return model }
        return LLMProvider.provider(id: providerID, in: catalog)?.defaultModel
    }

    /// "Can also be set via ZAI_API_KEY environment variable" — the hint the
    /// settings view shows under the key field; nil when the provider has no
    /// env var or a literal key is already stored.
    public func envHint(catalog: [LLMProvider]) -> String? {
        guard let env = LLMProvider.provider(id: providerID, in: catalog)?.envVarName else { return nil }
        if case .literal = apiKey { return nil }
        return "Can also be set via \(env) environment variable."
    }
}

extension LLMProvider {
    public static func provider(id: String, in catalog: [LLMProvider]) -> LLMProvider? {
        catalog.first { $0.id == id }
    }
}

// MARK: - Storage

/// Persistence seam — the host supplies storage (UserDefaults here,
/// Keychain-backed elsewhere). Config carries at most a literal key; hosts
/// wanting zero key-at-rest should only ever build `.environment` specs.
public protocol LLMInferenceConfigStoring: Sendable {
    func load() -> LLMInferenceConfig?
    func save(_ config: LLMInferenceConfig) throws
}

/// Defaults impl over `UserDefaults` (thread-safe but not marked Sendable,
/// hence `@unchecked`).
public struct UserDefaultsLLMInferenceConfigStore: LLMInferenceConfigStoring, @unchecked Sendable {
    private let defaults: UserDefaults
    private let key: String

    public init(defaults: UserDefaults = .standard, key: String = "tobor-kit.llm-inference.config") {
        self.defaults = defaults
        self.key = key
    }

    public func load() -> LLMInferenceConfig? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(LLMInferenceConfig.self, from: data)
    }

    public func save(_ config: LLMInferenceConfig) throws {
        let data = try JSONEncoder().encode(config)
        defaults.set(data, forKey: key)
    }
}

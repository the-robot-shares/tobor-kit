import Foundation

/// The wire shape a provider speaks. `openAI` covers OpenAI-compatible
/// endpoints (`POST {base}/chat/completions`); `anthropic` is the Messages
/// API (`POST {base}/messages`).
public enum LLMApiShape: String, Sendable, Hashable, Codable, CaseIterable {
    case openAI = "openai"
    case anthropic
}

/// One entry of the provider catalog — the static half of the LLM Inference
/// pod, ported 1:1 from llm-toolkit's Settings page
/// (`packages/web/src/pages/Settings.tsx`, "LLM Inference" section): the
/// picker's known providers with their picker grouping, default endpoints,
/// base-URL placeholders, env-var key names, and model placeholders.
///
/// Ported tables (llm-toolkit is authoritative):
/// - `ENV_KEY_NAMES` → ``envVarName``
/// - `MODEL_PLACEHOLDERS` → ``defaultModel``
/// - `BASE_URL_PLACEHOLDERS` → ``baseURLPlaceholder`` (display hint; the
///   effective endpoint is ``defaultBaseURL``)
/// - `llmNeedsBaseUrl` (ollama / litellm / custom / zai) → ``showsBaseURL``
/// - `llmNeedsKey` (everything but ollama) → ``requiresKey``
public struct LLMProvider: Identifiable, Sendable, Hashable {
    /// Stable id persisted in `LLMInferenceConfig.providerID` ("openai",
    /// "anthropic", "zai", "litellm", "ollama", "custom", …).
    public let id: String
    public let label: String
    /// Picker grouping, mirroring llm-toolkit's Cloud / Proxies-&-Local /
    /// Advanced sections.
    public let group: Group
    /// The provider's pinned wire shape. `nil` only for `custom`, whose
    /// shape the user picks at runtime (stored on the config, not here).
    public let apiShape: LLMApiShape?
    /// Endpoint used when the config carries no override. nil = the host
    /// must supply a URL.
    public let defaultBaseURL: URL?
    /// Greyed-out hint shown in the empty Base URL field (llm-toolkit's
    /// `BASE_URL_PLACEHOLDERS`).
    public let baseURLPlaceholder: String?
    /// Environment variable consulted when no literal key is stored; nil for
    /// local/no-key providers (llm-toolkit's `ENV_KEY_NAMES`).
    public let envVarName: String?
    /// llm-toolkit's `llmNeedsKey`: every provider but ollama.
    public let requiresKey: Bool
    /// Placeholder / "Default (…)" label (llm-toolkit's `MODEL_PLACEHOLDERS`).
    public let defaultModel: String?
    /// What the provider generates (``LLMModality``). `nil` or empty means
    /// `[.text]` — the pre-modality default — so existing catalogs and
    /// call sites are untouched. Orthogonal to ``group``.
    public let modalities: [LLMModality]?

    /// Picker grouping, mirroring llm-toolkit's dropdown sections.
    public enum Group: String, Sendable, Hashable, CaseIterable {
        case cloud
        case proxyLocal
        case advanced
    }

    public init(
        id: String,
        label: String,
        group: Group,
        apiShape: LLMApiShape?,
        defaultBaseURL: URL?,
        baseURLPlaceholder: String?,
        envVarName: String?,
        requiresKey: Bool,
        defaultModel: String?,
        modalities: [LLMModality]? = nil
    ) {
        self.id = id
        self.label = label
        self.group = group
        self.apiShape = apiShape
        self.defaultBaseURL = defaultBaseURL
        self.baseURLPlaceholder = baseURLPlaceholder
        self.envVarName = envVarName
        self.requiresKey = requiresKey
        self.defaultModel = defaultModel
        self.modalities = modalities
    }
}

extension LLMProvider {
    /// The built-in catalog, in picker order — exactly llm-toolkit's
    /// Settings dropdown: None / ── Cloud Providers ── / ── Proxies & Local
    /// ── / ── Advanced ──.
    public static let catalog: [LLMProvider] = [
        // ── Cloud Providers ──
        LLMProvider(
            id: "anthropic", label: "Anthropic (Claude)", group: .cloud, apiShape: .anthropic,
            defaultBaseURL: URL(string: "https://api.anthropic.com/v1"),
            baseURLPlaceholder: nil,
            envVarName: "ANTHROPIC_API_KEY", requiresKey: true,
            defaultModel: "claude-sonnet-4-20250514"
        ),
        LLMProvider(
            id: "openai", label: "OpenAI", group: .cloud, apiShape: .openAI,
            defaultBaseURL: URL(string: "https://api.openai.com/v1"),
            baseURLPlaceholder: nil,
            envVarName: "OPENAI_API_KEY", requiresKey: true,
            defaultModel: "gpt-4o"
        ),
        LLMProvider(
            id: "deepseek", label: "DeepSeek", group: .cloud, apiShape: .openAI,
            defaultBaseURL: URL(string: "https://api.deepseek.com/v1"),
            baseURLPlaceholder: nil,
            envVarName: "DEEPSEEK_API_KEY", requiresKey: true,
            defaultModel: "deepseek-chat"
        ),
        LLMProvider(
            id: "groq", label: "Groq", group: .cloud, apiShape: .openAI,
            defaultBaseURL: URL(string: "https://api.groq.com/openai/v1"),
            baseURLPlaceholder: nil,
            envVarName: "GROQ_API_KEY", requiresKey: true,
            defaultModel: "llama-3.3-70b"
        ),
        LLMProvider(
            id: "cerebras", label: "Cerebras", group: .cloud, apiShape: .openAI,
            defaultBaseURL: URL(string: "https://api.cerebras.ai/v1"),
            baseURLPlaceholder: nil,
            envVarName: "CEREBRAS_API_KEY", requiresKey: true,
            defaultModel: "llama-3.3-70b"
        ),
        // Z.ai selection presets model + coding-plan base URL into the
        // config (llm-toolkit's provider-switch branch); the catalog default
        // matches that preset.
        LLMProvider(
            id: "zai", label: "Z.ai (Zhipu/GLM)", group: .cloud, apiShape: .openAI,
            defaultBaseURL: URL(string: "https://api.z.ai/api/coding/paas/v4"),
            baseURLPlaceholder: "https://api.z.ai/api/coding/paas/v4",
            envVarName: "ZAI_API_KEY", requiresKey: true,
            defaultModel: "glm-5.3-flash"
        ),
        // ── Proxies & Local ──
        LLMProvider(
            id: "litellm", label: "LiteLLM Proxy", group: .proxyLocal, apiShape: .openAI,
            defaultBaseURL: URL(string: "https://inference.noizu.com/v1"),
            baseURLPlaceholder: "https://inference.noizu.com/v1",
            envVarName: "LITELLM_API_KEY", requiresKey: true,
            defaultModel: "claude-sonnet-4-6"
        ),
        LLMProvider(
            id: "ollama", label: "Ollama (Local)", group: .proxyLocal, apiShape: .openAI,
            defaultBaseURL: URL(string: "http://localhost:11434"),
            baseURLPlaceholder: "http://localhost:11434",
            envVarName: nil, requiresKey: false,
            defaultModel: "llama3"
        ),
        // ── Advanced ──
        LLMProvider(
            id: "custom", label: "Custom Endpoint", group: .advanced, apiShape: nil,
            defaultBaseURL: nil,
            baseURLPlaceholder: "https://api.example.com/v1",
            envVarName: nil, requiresKey: true,
            defaultModel: "model-name"
        ),
    ]

    public static func provider(id: String) -> LLMProvider? {
        catalog.first { $0.id == id }
    }
}

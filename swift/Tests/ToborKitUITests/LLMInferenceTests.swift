import XCTest
import SwiftUI
import ToborKitCore
@testable import ToborKitUI

#if canImport(AppKit)
import AppKit
#endif

/// Unit coverage for the LLM Inference pod: catalog shapes, key-spec
/// resolution, request building for both API shapes (mocked transport), and
/// models-parse. Mocks the transport, never the network.
final class LLMInferenceTests: XCTestCase {

    // MARK: Mock transport

    private final class MockTransport: HTTPTransporting, @unchecked Sendable {
        var handler: @Sendable (URLRequest) throws -> (Data, Int)
        private(set) var lastRequest: URLRequest?

        init(handler: @escaping @Sendable (URLRequest) throws -> (Data, Int)) {
            self.handler = handler
        }

        func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
            lastRequest = request
            let (data, status) = try handler(request)
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: status,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            return (data, response)
        }

        func stream(_ request: URLRequest) async throws -> (AsyncThrowingStream<Data, any Error>, HTTPURLResponse) {
            fatalError("LLM Inference is non-streaming; stream() must not be called")
        }
    }

    private static func openAICompletionJSON(content: String = "Hello there.", model: String = "gpt-4o") -> Data {
        let json = """
        {"id":"c1","model":"\(model)","choices":[{"index":0,"message":{"role":"assistant","content":"\(content)"},"finish_reason":"stop"}]}
        """
        return Data(json.utf8)
    }

    private static func anthropicCompletionJSON(content: String = "Bonjour.", model: String = "claude-sonnet-4-20250514") -> Data {
        let json = """
        {"id":"m1","model":"\(model)","content":[{"type":"text","text":"\(content)"}],"stop_reason":"end_turn"}
        """
        return Data(json.utf8)
    }

    private static func modelsJSON(ids: [String]) -> Data {
        let list = ids.map { #"{"id":"\#($0)"}"# }.joined(separator: ",")
        return Data(#"{"object":"list","data":[\#(list)]}"#.utf8)
    }

    // MARK: Catalog

    func testCatalogShapesAndEnvVars() {
        XCTAssertEqual(LLMProvider.provider(id: "openai")?.apiShape, .openAI)
        XCTAssertEqual(LLMProvider.provider(id: "openai")?.envVarName, "OPENAI_API_KEY")
        XCTAssertEqual(LLMProvider.provider(id: "openai")?.defaultBaseURL?.absoluteString, "https://api.openai.com/v1")

        XCTAssertEqual(LLMProvider.provider(id: "anthropic")?.apiShape, .anthropic)
        XCTAssertEqual(LLMProvider.provider(id: "anthropic")?.defaultBaseURL?.absoluteString, "https://api.anthropic.com/v1")

        // Z.ai presets the coding-plan endpoint + glm-5.3-flash (the
        // llm-toolkit selection branch).
        XCTAssertEqual(LLMProvider.provider(id: "zai")?.apiShape, .openAI)
        XCTAssertEqual(LLMProvider.provider(id: "zai")?.defaultBaseURL?.absoluteString, "https://api.z.ai/api/coding/paas/v4")
        XCTAssertEqual(LLMProvider.provider(id: "zai")?.envVarName, "ZAI_API_KEY")
        XCTAssertEqual(LLMProvider.provider(id: "zai")?.defaultModel, "glm-5.3-flash")

        // The full picker roster: cloud / proxies & local / advanced.
        XCTAssertEqual(LLMProvider.provider(id: "deepseek")?.envVarName, "DEEPSEEK_API_KEY")
        XCTAssertEqual(LLMProvider.provider(id: "groq")?.envVarName, "GROQ_API_KEY")
        XCTAssertEqual(LLMProvider.provider(id: "cerebras")?.envVarName, "CEREBRAS_API_KEY")
        XCTAssertEqual(LLMProvider.provider(id: "litellm")?.group, .proxyLocal)
        XCTAssertEqual(LLMProvider.provider(id: "litellm")?.envVarName, "LITELLM_API_KEY")
        XCTAssertEqual(LLMProvider.provider(id: "ollama")?.group, .proxyLocal)
        XCTAssertEqual(LLMProvider.provider(id: "custom")?.group, .advanced)
        XCTAssertNil(LLMProvider.provider(id: "custom")!.apiShape)

        // llmNeedsKey: everything but ollama. llmNeedsBaseUrl: the
        // placeholder-bearing providers only.
        XCTAssertTrue(LLMProvider.provider(id: "ollama")!.requiresKey == false)
        for id in ["anthropic", "openai", "deepseek", "groq", "cerebras", "zai", "litellm", "custom"] {
            XCTAssertTrue(LLMProvider.provider(id: id)!.requiresKey, id)
        }
        XCTAssertEqual(["ollama", "litellm", "custom", "zai"].map { LLMProvider.provider(id: $0)!.showsBaseURL },
                       [true, true, true, true])
        XCTAssertFalse(LLMProvider.provider(id: "openai")!.showsBaseURL)
        XCTAssertFalse(LLMProvider.provider(id: "anthropic")!.showsBaseURL)
    }

    // MARK: Key spec resolution

    func testKeySpecResolution() {
        let env = ["ZAI_API_KEY": "zkey-123"]
        XCTAssertEqual(LLMKeySpec.environment(name: "ZAI_API_KEY").resolve(environment: env), "zkey-123")
        XCTAssertNil(LLMKeySpec.environment(name: "MISSING_KEY").resolve(environment: env))
        // An empty env value counts as unset.
        XCTAssertNil(LLMKeySpec.environment(name: "EMPTY").resolve(environment: ["EMPTY": ""]))
        XCTAssertEqual(LLMKeySpec.literal("abc").resolve(environment: [:]), "abc")
        XCTAssertNil(LLMKeySpec.literal("").resolve(environment: [:]))
    }

    func testKeySpecCodableRoundTrip() throws {
        let env = LLMInferenceConfig(providerID: "zai", apiKey: .environment(name: "ZAI_API_KEY"))
        let lit = LLMInferenceConfig(providerID: "zai", apiKey: .literal("sk-test"))
        let decoder = JSONDecoder()
        for original in [env, lit] {
            let data = try JSONEncoder().encode(original)
            let decoded = try decoder.decode(LLMInferenceConfig.self, from: data)
            XCTAssertEqual(decoded, original)
        }
    }

    func testConfigEffectiveValues() {
        // Override wins over the catalog default.
        var config = LLMInferenceConfig(providerID: "openai", baseURL: URL(string: "https://proxy.example.com/v1"))
        XCTAssertEqual(config.effectiveBaseURL(catalog: LLMProvider.catalog)?.absoluteString, "https://proxy.example.com/v1")
        config.baseURL = nil
        XCTAssertEqual(config.effectiveBaseURL(catalog: LLMProvider.catalog)?.absoluteString, "https://api.openai.com/v1")

        // Custom's shape pin defaults to openAI when unset.
        XCTAssertEqual(LLMInferenceConfig(providerID: "custom").effectiveAPIShape(catalog: LLMProvider.catalog), .openAI)
        XCTAssertEqual(
            LLMInferenceConfig(providerID: "custom", apiShape: .anthropic).effectiveAPIShape(catalog: LLMProvider.catalog),
            .anthropic
        )

        // Model falls back to the provider default.
        XCTAssertEqual(
            LLMInferenceConfig(providerID: "anthropic").effectiveModel(catalog: LLMProvider.catalog),
            "claude-sonnet-4-20250514"
        )

        // The hint disappears once a literal key is stored.
        let envConfig = LLMInferenceConfig(providerID: "zai", apiKey: .environment(name: "ZAI_API_KEY"))
        XCTAssertEqual(envConfig.envHint(catalog: LLMProvider.catalog), "Can also be set via ZAI_API_KEY environment variable.")
        let litConfig = LLMInferenceConfig(providerID: "zai", apiKey: .literal("sk"))
        XCTAssertNil(litConfig.envHint(catalog: LLMProvider.catalog))
    }

    // MARK: Request building — OpenAI shape

    func testOpenAICompletionRequest() async throws {
        let transport = MockTransport { _ in (Self.openAICompletionJSON(), 200) }
        let config = LLMInferenceConfig(
            providerID: "openai",
            apiKey: .literal("sk-live"),
            model: "gpt-4o"
        )
        let client = LLMInferenceClient(config: config, transport: transport)

        let reply = try await client.complete("Hi", maxTokens: 64)
        XCTAssertEqual(reply.content, "Hello there.")
        XCTAssertEqual(reply.model, "gpt-4o")
        XCTAssertGreaterThanOrEqual(reply.latency, 0)

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.url?.absoluteString, "https://api.openai.com/v1/chat/completions")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer sk-live")
        XCTAssertNil(request.value(forHTTPHeaderField: "x-api-key"))

        let body = try XCTUnwrap(request.httpBody)
        let json = try JSONDecoder().decode(JSONValue.self, from: body)
        XCTAssertEqual(json["model"]?.stringValue, "gpt-4o")
        XCTAssertEqual(json["max_tokens"]?.doubleValue, 64)
        guard case .array(let messages)? = json["messages"], let first = messages.first else {
            return XCTFail("expected messages array")
        }
        XCTAssertEqual(first["role"]?.stringValue, "user")
        XCTAssertEqual(first["content"]?.stringValue, "Hi")
    }

    // MARK: Request building — Anthropic shape

    func testAnthropicCompletionRequest() async throws {
        let transport = MockTransport { _ in (Self.anthropicCompletionJSON(), 200) }
        let config = LLMInferenceConfig(providerID: "anthropic", model: "claude-sonnet-4-20250514")
        let client = LLMInferenceClient(config: config, transport: transport, environment: ["ANTHROPIC_API_KEY": "ak-env"])

        let reply = try await client.complete("Salut")
        XCTAssertEqual(reply.content, "Bonjour.")

        let request = try XCTUnwrap(transport.lastRequest)
        XCTAssertEqual(request.url?.absoluteString, "https://api.anthropic.com/v1/messages")
        XCTAssertEqual(request.value(forHTTPHeaderField: "x-api-key"), "ak-env")
        XCTAssertEqual(request.value(forHTTPHeaderField: "anthropic-version"), "2023-06-01")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))

        let body = try XCTUnwrap(request.httpBody)
        let json = try JSONDecoder().decode(JSONValue.self, from: body)
        XCTAssertEqual(json["model"]?.stringValue, "claude-sonnet-4-20250514")
        XCTAssertEqual(json["max_tokens"]?.doubleValue, 256)
    }

    // MARK: Models listing

    func testModelsListingAndParse() async throws {
        let transport = MockTransport { request in
            XCTAssertEqual(request.url?.absoluteString, "https://api.z.ai/api/coding/paas/v4/models")
            return (Self.modelsJSON(ids: ["glm-5.3-flash", "glm-4.5-air"]), 200)
        }
        let config = LLMInferenceConfig(providerID: "zai")
        let client = LLMInferenceClient(config: config, transport: transport, environment: ["ZAI_API_KEY": "zk"])

        let models = try await client.models()
        XCTAssertEqual(models, ["glm-5.3-flash", "glm-4.5-air"])
        XCTAssertEqual(transport.lastRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer zk")
    }

    // MARK: Error typing

    func testErrorMapping() async {
        func statusError(_ status: Int, body: Data = Data("{}".utf8)) async -> LLMInferenceError? {
            let transport = MockTransport { _ in (body, status) }
            let config = LLMInferenceConfig(providerID: "openai", apiKey: .literal("k"), model: "gpt-4o")
            let client = LLMInferenceClient(config: config, transport: transport)
            do {
                _ = try await client.complete("x")
                return nil
            } catch let error as LLMInferenceError {
                return error
            } catch {
                XCTFail("unexpected error type: \(error)")
                return nil
            }
        }

        // 401 → unauthorized; 404 → notFound; 429 → rateLimited (Retry-After).
        let unauthorized401 = await statusError(401)
        XCTAssertEqual(unauthorized401, .unauthorized)
        let unauthorized403 = await statusError(403)
        XCTAssertEqual(unauthorized403, .unauthorized)
        let notFound = await statusError(404)
        XCTAssertEqual(notFound, .notFound)
        // Retry-After comes back as a header on the real response; the mock
        // omits it, so retryAfterSeconds stays nil but the case is right.
        let rateError = await statusError(429)
        guard case .rateLimited = rateError else {
            return XCTFail("expected rateLimited, got \(String(describing: rateError))")
        }
    }

    func testMissingKeyAndBaseURL() async {
        // openai requires a key; none stored and none in env → missingAPIKey.
        let noKey = LLMInferenceClient(
            config: LLMInferenceConfig(providerID: "openai", model: "gpt-4o"),
            transport: MockTransport { _ in (Data(), 200) },
            environment: [:]
        )
        do {
            _ = try await noKey.complete("x")
            XCTFail("expected missingAPIKey")
        } catch let error as LLMInferenceError {
            XCTAssertEqual(error, .missingAPIKey(expectedEnvVar: "OPENAI_API_KEY"))
            XCTAssertFalse(error.userMessage.isEmpty)
        } catch {
            XCTFail("unexpected error type: \(error)")
        }

        // local has no default URL and none stored → missingBaseURL.
        let noURL = LLMInferenceClient(
            config: LLMInferenceConfig(providerID: "local", model: "llama3"),
            transport: MockTransport { _ in (Data(), 200) },
            environment: [:]
        )
        do {
            _ = try await noURL.complete("x")
            XCTFail("expected missingBaseURL")
        } catch let error as LLMInferenceError {
            XCTAssertEqual(error, .missingBaseURL)
        } catch {
            XCTFail("unexpected error type: \(error)")
        }
    }

    // MARK: Storage

    func testUserDefaultsStoreRoundTrip() throws {
        let defaults = UserDefaults(suiteName: "llm-inference-tests")!
        defaults.removePersistentDomain(forName: "llm-inference-tests")
        let store = UserDefaultsLLMInferenceConfigStore(defaults: defaults)

        XCTAssertNil(store.load())

        let config = LLMInferenceConfig(providerID: "zai", model: "glm-4.6")
        try store.save(config)
        XCTAssertEqual(store.load(), config)
    }


    // MARK: Modality axis

    /// A host catalog declaring the media axis (openai text+image, suno
    /// audio, elevenlabs speech, runway video).
    private static let mediaCatalog: [LLMProvider] = [
        LLMProvider(
            id: "openai", label: "OpenAI", group: .cloud, apiShape: .openAI,
            defaultBaseURL: URL(string: "https://api.openai.com/v1"), baseURLPlaceholder: nil,
            envVarName: "OPENAI_API_KEY", requiresKey: true, defaultModel: "gpt-4o",
            modalities: [.text, .image]
        ),
        LLMProvider(
            id: "suno", label: "Suno", group: .cloud, apiShape: .openAI,
            defaultBaseURL: URL(string: "https://api.suno.ai/v1"), baseURLPlaceholder: nil,
            envVarName: "SUNO_API_KEY", requiresKey: true, defaultModel: "v6",
            modalities: [.audio]
        ),
        LLMProvider(
            id: "elevenlabs", label: "ElevenLabs", group: .cloud, apiShape: .openAI,
            defaultBaseURL: URL(string: "https://api.elevenlabs.io/v1"), baseURLPlaceholder: nil,
            envVarName: "ELEVENLABS_API_KEY", requiresKey: true, defaultModel: "eleven_v3",
            modalities: [.speech]
        ),
        LLMProvider(
            id: "runway", label: "Runway", group: .advanced, apiShape: .openAI,
            defaultBaseURL: nil, baseURLPlaceholder: "https://api.runwayml.com/v1",
            envVarName: nil, requiresKey: true, defaultModel: "gen-4",
            modalities: [.video]
        ),
    ]

    func testCatalogWithoutModalitiesReadsAsText() {
        XCTAssertFalse(LLMProvider.declaresModalities(in: LLMProvider.catalog))
        for provider in LLMProvider.catalog {
            XCTAssertNil(provider.modalities)
            XCTAssertEqual(provider.effectiveModalities, [.text])
            XCTAssertTrue(provider.supports(.text))
            XCTAssertFalse(provider.supports(.image))
        }
        XCTAssertEqual(LLMProvider.modalities(in: LLMProvider.catalog), [.text])
        XCTAssertEqual(LLMProvider.providers(in: LLMProvider.catalog, matching: .text).count, LLMProvider.catalog.count)
        XCTAssertTrue(LLMProvider.providers(in: LLMProvider.catalog, matching: .video).isEmpty)
    }

    func testEmptyModalityListFallsBackToText() {
        let provider = LLMProvider(
            id: "x", label: "X", group: .cloud, apiShape: .openAI, defaultBaseURL: nil,
            baseURLPlaceholder: nil, envVarName: nil, requiresKey: false, defaultModel: nil,
            modalities: []
        )
        XCTAssertEqual(provider.effectiveModalities, [.text])
        XCTAssertTrue(provider.supports(.text))
    }

    func testMediaCatalogSectionsByModality() {
        let catalog = Self.mediaCatalog
        XCTAssertTrue(LLMProvider.declaresModalities(in: catalog))
        XCTAssertEqual(LLMProvider.modalities(in: catalog), [.text, .image, .audio, .speech, .video])
        XCTAssertEqual(LLMProvider.providers(in: catalog, matching: .image).map(\.id), ["openai"])
        XCTAssertEqual(LLMModality.image.sectionTitle, "── Image ──")
    }

    @MainActor
    func testPickerProjectionsHonourSectioningAndFilter() {
        let config = LLMInferenceConfig()
        // Default axis over the stock catalog: unchanged group order.
        let stock = LLMInferenceSettingsView(config: .constant(config), environment: [:])
        XCTAssertEqual(stock.pickerSectionTitles, ["── Cloud Providers ──", "── Proxies & Local ──", "── Advanced ──"])
        XCTAssertEqual(stock.pickerProviderIDs, LLMProvider.catalog.map(\.id))

        // Modality sections over a media catalog.
        let sectioned = LLMInferenceSettingsView(
            config: .constant(config), catalog: Self.mediaCatalog, environment: [:], sectionBy: .modality
        )
        XCTAssertEqual(sectioned.pickerSectionTitles, ["── Text ──", "── Image ──", "── Audio ──", "── Speech ──", "── Video ──"])
        XCTAssertEqual(sectioned.pickerProviderIDs, ["openai", "openai", "suno", "elevenlabs", "runway"])

        // Filter narrows the catalog; group sectioning stays intact.
        let filtered = LLMInferenceSettingsView(
            config: .constant(config), catalog: Self.mediaCatalog, environment: [:], modality: .video
        )
        XCTAssertEqual(filtered.visibleCatalog.map(\.id), ["runway"])
        XCTAssertEqual(filtered.pickerProviderIDs, ["runway"])
    }

    func testModalityAndConfigCodableRoundTripWithoutTheNewField() throws {
        // A stored config payload that predates the modality axis decodes
        // unchanged — modality lives on the provider descriptor, not here.
        let legacy = Data(#"{"providerID":"zai","model":"glm-5.3-flash"}"#.utf8)
        let config = try JSONDecoder().decode(LLMInferenceConfig.self, from: legacy)
        XCTAssertEqual(config.providerID, "zai")
        XCTAssertEqual(config.effectiveModel(catalog: LLMProvider.catalog), "glm-5.3-flash")
        let reencoded = try JSONEncoder().encode(config)
        XCTAssertEqual(try JSONDecoder().decode(LLMInferenceConfig.self, from: reencoded), config)

        // The modality enum itself is wire-stable lowercase.
        let modalities = try JSONDecoder().decode([LLMModality].self, from: Data(#"["text","image","audio","speech","video"]"#.utf8))
        XCTAssertEqual(modalities, LLMModality.allCases)
        XCTAssertEqual(String(data: try JSONEncoder().encode([LLMModality.video]), encoding: .utf8), #"["video"]"#)
    }

    // MARK: View smoke (construct + render the canonical states)

    @MainActor
    func testSettingsViewRenders() {
        // No provider / provider selected (badge + full field set).
        for config in [
            LLMInferenceConfig(),
            LLMInferenceConfig(providerID: "zai", apiKey: .environment(name: "ZAI_API_KEY"), model: "glm-5.3-flash"),
            LLMInferenceConfig(providerID: "custom"),
        ] {
            let view = LLMInferenceSettingsView(config: .constant(config), environment: [:])
            let hosting = NSHostingView(rootView: view.frame(width: 420, height: 560))
            hosting.frame = NSRect(x: 0, y: 0, width: 420, height: 560)
            hosting.layoutSubtreeIfNeeded()
        }
    }
}

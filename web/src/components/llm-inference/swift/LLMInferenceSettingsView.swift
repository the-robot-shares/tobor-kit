import SwiftUI
import ToborKitCore

/// The LLM Inference settings surface — a 1:1 port of llm-toolkit's
/// Settings page LLM section
/// (`packages/web/src/pages/Settings.tsx`, "LLM Inference"), not a
/// redesign. Structure, field order, and state machine all follow the
/// reference:
///
/// 1. Header row: "LLM Inference" + status badge (green "<provider>
///    connected" once a provider is selected, yellow "Not configured"
///    otherwise — the reference derives it from saved status, never from a
///    test round trip).
/// 2. Provider picker: None / ── Cloud Providers ── / ── Proxies & Local
///    ── / ── Advanced ──. Switching follows the reference state machine:
///    None clears the whole config; Z.ai presets model `glm-5.3-flash` +
///    coding-plan base URL; every other provider keeps only the API key and
///    drops model / base URL / shape pin; the fetched model list clears.
/// 3. API Type picker — only for `custom` (OpenAI- vs
///    Anthropic-compatible).
/// 4. API Key — masked, with the reference's env-var hint ("Can also be
///    set via ZAI_API_KEY environment variable."). The key lives in the
///    config's `LLMKeySpec`, never logged; env specs are re-targeted to
///    the new provider's variable on switch.
/// 5. Base URL — inline (no disclosure) exactly for the providers the
///    reference shows it for: ollama / litellm / custom / zai, with the
///    reference's per-provider placeholders.
/// 6. Model — label row with a Fetch/Refresh models link; before the first
///    fetch a free-text field with the per-provider placeholder, after it
///    a picker (with "Default (…)") plus free-text custom entry and the
///    "N models available. Select from list or type a custom name."
///    caption.
/// 7. Test Connection box — prompt field (Enter submits), Test button
///    ("Sending…" while in flight), error box, response box, and the
///    reference's footer hint.
///
/// Contract rules carried over: the key is a `SecureField`, exists only in
/// the draft/config, and is never logged; an env-resolved key is preferred
/// over storing a literal.
public struct LLMInferenceSettingsView: View {

    // MARK: Inputs

    /// The persisted config; the host owns storage via the binding.
    @Binding public var config: LLMInferenceConfig
    public var catalog: [LLMProvider]
    /// Optional modality filter — only providers producing it are offered.
    /// `nil` (the default) offers the whole catalog, exactly as before.
    public var modality: LLMModality?
    /// Which axis the provider picker sections on: ``SectionAxis/group``
    /// (the historic Cloud / Proxies & Local / Advanced headings) or
    /// ``SectionAxis/modality`` (Text / Image / Audio / Speech / Video).
    public var sectionBy: SectionAxis
    public var transport: any HTTPTransporting
    /// Injectable so hosts/tests resolve keys without touching
    /// `ProcessInfo` (Keychain-backed resolution, sandbox previews).
    public var environment: [String: String]

    // MARK: Models state

    @State private var availableModels: [String] = []
    @State private var loadingModels = false
    @State private var modelsError: String?

    // MARK: Test Connection state

    @State private var testPrompt = ""
    @State private var testReply: String?
    @State private var testError: String?
    @State private var testing = false

    @State private var draftKey = ""

    /// Provider-picker sectioning axis. Deployment `group` stays the
    /// default; `modality` is the opt-in media axis.
    public enum SectionAxis: String, Sendable, Hashable, CaseIterable {
        case group
        case modality
    }

    public init(
        config: Binding<LLMInferenceConfig>,
        catalog: [LLMProvider] = LLMProvider.catalog,
        transport: any HTTPTransporting = URLSessionTransport(),
        environment: [String: String] = ProcessInfo.processInfo.environment,
        modality: LLMModality? = nil,
        sectionBy: SectionAxis = .group
    ) {
        self._config = config
        self.catalog = catalog
        self.transport = transport
        self.environment = environment
        self.modality = modality
        self.sectionBy = sectionBy
    }

    /// Catalog after the optional modality filter (identity when unset).
    public var visibleCatalog: [LLMProvider] {
        guard let modality else { return catalog }
        return LLMProvider.providers(in: catalog, matching: modality)
    }

    private var providerID: String { config.providerID }
    private var provider: LLMProvider? {
        LLMProvider.provider(id: providerID, in: catalog)
    }

    // MARK: Body — field order mirrors the reference section exactly.

    public var body: some View {
        Form {
            // Reference header row: title + status badge.
            Section {
                HStack {
                    Text("LLM Inference")
                        .font(.headline)
                    Spacer()
                    statusBadge
                }
                providerPicker
            }

            if provider != nil {
                if providerID == "custom" {
                    // Reference: API Type only for Custom Endpoint.
                    Picker("API Type", selection: shapeBinding) {
                        Text("OpenAI-compatible").tag(LLMApiShape.openAI)
                        Text("Anthropic-compatible").tag(LLMApiShape.anthropic)
                    }
                }

                if provider!.requiresKey {
                    apiKeyField
                }

                // Reference `llmNeedsBaseUrl`: ollama / litellm / custom /
                // zai — inline field, per-provider placeholder.
                if provider!.showsBaseURL {
                    baseURLField
                }

                modelSection

                testConnectionSection
            }
        }
        .formStyle(.grouped)
    }

    // MARK: Provider

    private var providerPicker: some View {
        Picker("Provider", selection: providerBinding) {
            Text("None").tag("")
            if sectionBy == .modality {
                modalitySections
            } else {
                groupSections
            }
        }
    }

    /// Reference default: deployment-location sections.
    @ViewBuilder
    private var groupSections: some View {
        let catalog = visibleCatalog
        Text("── Cloud Providers ──").tag("").disabled(true)
        ForEach(catalog.filter { $0.group == .cloud }) { provider in
            Text(provider.label).tag(provider.id)
        }
        Text("── Proxies & Local ──").tag("").disabled(true)
        ForEach(catalog.filter { $0.group == .proxyLocal }) { provider in
            Text(provider.label).tag(provider.id)
        }
        Text("── Advanced ──").tag("").disabled(true)
        ForEach(catalog.filter { $0.group == .advanced }) { provider in
            Text(provider.label).tag(provider.id)
        }
    }

    /// Opt-in media axis: one section per modality the catalog declares.
    @ViewBuilder
    private var modalitySections: some View {
        let catalog = visibleCatalog
        ForEach(LLMProvider.modalities(in: catalog), id: \.self) { modality in
            Text(modality.sectionTitle).tag("").disabled(true)
            ForEach(catalog.filter { $0.supports(modality) }) { provider in
                Text(provider.label).tag(provider.id)
            }
        }
    }

    /// The provider ids the picker offers, in render order — the testable
    /// projection of ``providerPicker`` (SwiftUI bodies aren't inspectable).
    public var pickerProviderIDs: [String] {
        let catalog = visibleCatalog
        if sectionBy == .modality {
            return LLMProvider.modalities(in: catalog).flatMap { modality in
                catalog.filter { $0.supports(modality) }.map(\.id)
            }
        }
        return LLMProvider.Group.allCases.flatMap { group in
            catalog.filter { $0.group == group }.map(\.id)
        }
    }

    /// Section headings the picker renders, in order — the testable
    /// projection of the section rows.
    public var pickerSectionTitles: [String] {
        if sectionBy == .modality {
            return LLMProvider.modalities(in: visibleCatalog).map(\.sectionTitle)
        }
        return ["── Cloud Providers ──", "── Proxies & Local ──", "── Advanced ──"]
    }

    /// The reference's provider-switch state machine (Settings.tsx,
    /// provider `onChange`): clear the fetched model list; None clears the
    /// whole config; zai presets model + coding-plan base URL; anything
    /// else keeps only the key and drops model / base URL / shape pin.
    private var providerBinding: Binding<String> {
        Binding(
            get: { config.providerID },
            set: { newValue in
                availableModels = []
                modelsError = nil
                if newValue.isEmpty {
                    config = LLMInferenceConfig()
                    return
                }
                config.providerID = newValue
                config.apiShape = nil
                // Re-target env key specs to the new provider's variable;
                // literal keys survive the switch (reference behavior).
                if case .environment = config.apiKey {
                    config.apiKey = LLMProvider.provider(id: newValue, in: catalog)?
                        .envVarName.map(LLMKeySpec.environment)
                }
                if newValue == "zai" {
                    config.model = "glm-5.3-flash"
                    config.baseURL = URL(string: "https://api.z.ai/api/coding/paas/v4")
                } else {
                    config.model = nil
                    config.baseURL = nil
                }
            }
        )
    }

    /// Reference badge: availability state of the configured provider —
    /// never the outcome of a test round trip.
    @ViewBuilder
    private var statusBadge: some View {
        if providerID.isEmpty {
            badgeLabel(color: .yellow, text: "Not configured")
        } else {
            badgeLabel(color: .green, text: "\(providerID) connected")
        }
    }

    private func badgeLabel(color: Color, text: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(text).font(.caption).foregroundStyle(color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(color.opacity(0.12))
        .clipShape(Capsule())
    }

    // MARK: API key

    /// Reference: masked input, placeholder "Enter API key (or set via
    /// environment variable)", env hint when the provider has one.
    private var apiKeyField: some View {
        Section("API Key") {
            SecureField("Enter API key (or set via environment variable)", text: draftKeyBinding)
            if let env = provider?.envVarName {
                Text("Can also be set via \(env) environment variable.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else if providerID == "custom" {
                Text("The key is sent as the endpoint's auth header (Bearer, or x-api-key for Anthropic-shaped endpoints).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    /// Typing a key stores a literal spec; clearing it falls back to the
    /// provider's env var (resolved at call time). The literal never leaves
    /// config storage — it is not echoed back into the field.
    private var draftKeyBinding: Binding<String> {
        Binding(
            get: { draftKey },
            set: { newValue in
                draftKey = newValue
                let trimmed = newValue.trimmingCharacters(in: .whitespaces)
                if let env = provider?.envVarName {
                    config.apiKey = trimmed.isEmpty ? .environment(name: env) : .literal(trimmed)
                } else {
                    config.apiKey = trimmed.isEmpty ? nil : .literal(trimmed)
                }
            }
        )
    }

    // MARK: Base URL

    private var baseURLField: some View {
        Section("Base URL") {
            TextField(
                provider?.baseURLPlaceholder ?? "https://api.example.com/v1",
                text: baseURLBinding
            )
            .autocorrectionDisabled()
            .textFieldStyle(.roundedBorder)
        }
    }

    /// The stored override only; empty string clears it back to the
    /// catalog default rather than persisting a duplicate.
    private var baseURLBinding: Binding<String> {
        Binding(
            get: { config.baseURL?.absoluteString ?? "" },
            set: { newValue in
                let trimmed = newValue.trimmingCharacters(in: .whitespaces)
                config.baseURL = trimmed.isEmpty ? nil : URL(string: trimmed)
            }
        )
    }

    private var shapeBinding: Binding<LLMApiShape> {
        Binding(
            get: { config.effectiveAPIShape(catalog: catalog) },
            set: { config.apiShape = $0 }
        )
    }

    // MARK: Model

    /// Reference model block: "Model" label with a trailing Fetch/Refresh
    /// models link; pre-fetch a free-text field with the per-provider
    /// placeholder, post-fetch a picker (with "Default (…)") plus a
    /// free-text custom entry bound to the same value.
    private var modelSection: some View {
        Section {
            HStack {
                Text("Model").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Button {
                    Task { await fetchModels() }
                } label: {
                    if loadingModels {
                        Text("Loading...")
                    } else {
                        Text(availableModels.isEmpty ? "Fetch models" : "Refresh models")
                    }
                }
                .buttonStyle(.borderless)
                .disabled(loadingModels)
                .font(.caption)
            }

            if availableModels.isEmpty {
                TextField(
                    provider?.defaultModel ?? "model-name",
                    text: modelBinding
                )
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
                Text(loadingModels
                     ? "Fetching available models..."
                     : "Save settings and click \"Fetch models\" to populate the dropdown, or type a model name.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Picker("Model", selection: modelBinding) {
                    Text("Default (\(provider?.defaultModel ?? "auto"))").tag("")
                    ForEach(availableModels, id: \.self) { model in
                        Text(model).tag(model)
                    }
                }

                TextField(
                    "Or type a model name manually",
                    text: modelBinding
                )
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
                .font(.caption)

                Text("\(availableModels.count) model\(availableModels.count == 1 ? "" : "s") available. Select from list or type a custom name.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let modelsError {
                Text(modelsError).font(.caption).foregroundStyle(.red)
            }
        }
    }

    private var modelBinding: Binding<String> {
        Binding(
            get: { config.model ?? "" },
            set: { newValue in
                let trimmed = newValue.trimmingCharacters(in: .whitespaces)
                config.model = trimmed.isEmpty ? nil : trimmed
            }
        )
    }

    /// Reference "Fetch models" / "Refresh models": POST the current draft
    /// config to the provider's listing endpoint. Endpoints that do not
    /// implement listing (notably Z.ai) surface the error; free-text entry
    /// stays the path in.
    private func fetchModels() async {
        loadingModels = true
        modelsError = nil
        defer { loadingModels = false }
        do {
            availableModels = try await makeClient().models()
        } catch let error as LLMInferenceError {
            modelsError = error.userMessage
        } catch {
            modelsError = error.localizedDescription
        }
    }

    // MARK: Test Connection

    /// Reference Test Connection box: bordered section, prompt field
    /// (Enter submits), Test button ("Sending..." while in flight), red
    /// error box, response box, footer hint.
    private var testConnectionSection: some View {
        Section {
            HStack {
                TextField("Say hello in one sentence", text: $testPrompt)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { Task { await runTest() } }
                Button {
                    Task { await runTest() }
                } label: {
                    Text(testing ? "Sending..." : "Test")
                }
                .disabled(testing)
            }

            if let testError {
                Text(testError)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            if let testReply {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Response:").font(.caption).foregroundStyle(.secondary)
                    Text(testReply).textSelection(.enabled)
                }
            }

            Text("Save settings first, then send a test message to verify the provider is reachable.")
                .font(.caption)
                .foregroundStyle(.secondary)
        } header: {
            Text("Test Connection").font(.caption).foregroundStyle(.secondary)
        }
    }

    /// Reference default prompt: "Say hello in one sentence".
    private func runTest() async {
        testing = true
        testReply = nil
        testError = nil
        defer { testing = false }
        let prompt = testPrompt.trimmingCharacters(in: .whitespaces)
        do {
            let reply = try await makeClient().complete(prompt.isEmpty ? "Say hello in one sentence" : prompt)
            testReply = reply.content
        } catch let error as LLMInferenceError {
            testError = error.userMessage
        } catch {
            testError = error.localizedDescription
        }
    }

    private func makeClient() -> LLMInferenceClient {
        LLMInferenceClient(
            config: config,
            catalog: catalog,
            transport: transport,
            environment: environment
        )
    }
}

extension LLMProvider {
    /// Reference `llmNeedsBaseUrl`: the Base URL field renders for ollama,
    /// litellm, custom, and zai only. The catalog encodes that set via the
    /// per-provider placeholder; hosts adding their own providers opt in
    /// (or out) the same way.
    public var showsBaseURL: Bool {
        baseURLPlaceholder != nil
    }
}

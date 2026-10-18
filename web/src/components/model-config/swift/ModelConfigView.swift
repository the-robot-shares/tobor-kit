import SwiftUI
import ToborKitCore

/// Swift mirror of `<noizu-model-config>` — the model picker island.
///
/// Properties down, callbacks up; the host persists. Contract rules carried
/// over from the lit element:
///
/// - `inherit` adds an Inherit option; the host owns nearest-ancestor-wins.
/// - `allowCustom` adds a Custom… endpoint editor (base URL + model + key).
///   Saving emits both the endpoint and the resulting `custom:<model>` spec.
/// - An empty or masked API key saves as `""` — "keep the stored key". The
///   draft clears only when a real key was saved; the key is never logged.
/// - A stored value matching no catalog entry renders as an extra option
///   instead of disappearing (the host's value is never silently lost).
public struct ModelConfigView: View {

    // MARK: Inputs (mirror the element's properties)

    public var catalog: [ModelCatalogEntry]
    /// When set (and `catalog` is empty) the model fetches the catalog from
    /// this URL — the `catalog-url` attribute.
    public var catalogURL: URL?
    /// The stored spec; empty / `inherit` means inherit (when `inherit` is on).
    @Binding public var value: String
    public var inherit: Bool
    public var allowCustom: Bool
    public var allowBudget: Bool
    @Binding public var budget: Double?
    /// Current custom endpoint; may carry a masked `apiKey` echo.
    public var customEndpoint: CustomEndpoint?

    // MARK: Callbacks (mirror `model-change` / `custom-endpoint-save` / `budget-change`)

    public var onModelChange: ((String) -> Void)?
    /// `apiKey` is `""` when empty/masked input meant "keep the stored key".
    public var onCustomEndpointSave: ((CustomEndpointSave) -> Void)?
    public var onBudgetChange: ((Double?) -> Void)?

    @State private var draftBaseUrl = ""
    @State private var draftModel = ""
    @State private var draftApiKey = ""
    @State private var loaded: [ModelCatalogEntry] = []
    @State private var catalogError = ""
    /// Dedupe guard: `saveEndpoint` emits `model-change` unconditionally
    /// (the lit element does too), so the `onChange` pass over the same
    /// value must not double-emit.
    @State private var lastNotifiedValue: String?

    public init(
        catalog: [ModelCatalogEntry] = [],
        catalogURL: URL? = nil,
        value: Binding<String> = .constant(""),
        inherit: Bool = false,
        allowCustom: Bool = false,
        allowBudget: Bool = false,
        budget: Binding<Double?> = .constant(nil),
        customEndpoint: CustomEndpoint? = nil,
        onModelChange: ((String) -> Void)? = nil,
        onCustomEndpointSave: ((CustomEndpointSave) -> Void)? = nil,
        onBudgetChange: ((Double?) -> Void)? = nil
    ) {
        self.catalog = catalog
        self.catalogURL = catalogURL
        self._value = value
        self.inherit = inherit
        self.allowCustom = allowCustom
        self.allowBudget = allowBudget
        self._budget = budget
        self.customEndpoint = customEndpoint
        self.onModelChange = onModelChange
        self.onCustomEndpointSave = onCustomEndpointSave
        self.onBudgetChange = onBudgetChange
    }

    /// `catalog` wins over the fetched list — the property/attribute
    /// precedence in the lit element (`entries()`).
    public var entries: [ModelCatalogEntry] {
        catalog.isEmpty ? loaded : catalog
    }

    public var body: some View {
        let selected = ModelPickerSelection.resolve(
            value: value, inherit: inherit, allowCustom: allowCustom, entries: entries
        )
        let showCustom = allowCustom && selected == .custom
        return Form {
            Picker("Model", selection: modelSelection(selected: selected)) {
                if inherit {
                    Text("Inherit").tag(ModelConfigOption.inherit)
                }
                if !inherit && value.isEmpty {
                    Text("Select a model…").tag("")
                        .foregroundStyle(.secondary)
                }
                ForEach(entries) { entry in
                    Text(entry.label?.trimmingCharacters(in: .whitespaces).isEmpty == false
                         ? entry.label!.trimmingCharacters(in: .whitespaces)
                         : specOf(entry))
                        .tag(specOf(entry))
                }
                if allowCustom {
                    Text("Custom…").tag(ModelConfigOption.custom)
                }
                if case .orphan(let spec) = selected {
                    Text(spec).tag(spec)
                }
            }
            .onChange(of: value) { _, newValue in
                guard newValue != lastNotifiedValue else { return }
                lastNotifiedValue = newValue
                onModelChange?(newValue)
            }

            if !catalogError.isEmpty {
                Text(catalogError)
                    .foregroundStyle(.red)
                    .font(.caption)
            }

            if showCustom {
                customEndpointSection
            }

            if allowBudget {
                LabeledContent("Budget") {
                    TextField("0", value: budgetBinding, format: .number)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 120)
                }
            }
        }
        .formStyle(.grouped)
        .task(id: catalogURL?.absoluteString) { await loadCatalog() }
        .onAppear { applyCustom(customEndpoint) }
        .onChange(of: customEndpoint) { _, endpoint in applyCustom(endpoint) }
    }

    // MARK: Custom endpoint section (the lit fieldset)

    private var customEndpointSection: some View {
        Section("Custom endpoint") {
            TextField("Base URL", text: $draftBaseUrl, prompt: Text("https://api.openai.com/v1"))
                .autocorrectionDisabled()
            TextField("Model", text: $draftModel)
                .autocorrectionDisabled()
            let masked = isMaskedSecret(draftApiKey)
            if masked {
                // A masked echo is data — show it as text, not a password box,
                // so the host's echoed hint stays readable.
                TextField("API key (stored)", text: $draftApiKey)
                    .autocorrectionDisabled()
            } else {
                SecureField("API key", text: $draftApiKey)
            }
            Button("Save endpoint") { saveEndpoint() }
        }
    }

    private func saveEndpoint() {
        let baseUrl = draftBaseUrl.trimmingCharacters(in: .whitespaces)
        let model = draftModel.trimmingCharacters(in: .whitespaces)
        let apiKey = apiKeyForSave(draftApiKey)
        let spec = customSpec(model: model)
        value = spec
        lastNotifiedValue = spec
        onCustomEndpointSave?(CustomEndpointSave(baseUrl: baseUrl, model: model, apiKey: apiKey))
        onModelChange?(spec)
        // Only a freshly typed (unmasked) key clears the draft — a masked
        // echo stays so the host's hint is not wiped from the screen.
        if !apiKey.isEmpty {
            draftApiKey = ""
        }
    }

    private func applyCustom(_ endpoint: CustomEndpoint?) {
        guard let endpoint else { return }
        draftBaseUrl = endpoint.baseUrl
        draftModel = endpoint.model
        draftApiKey = endpoint.apiKey ?? ""
    }

    // MARK: Selection plumbing

    /// The Picker selection is a string that is either a spec, the inherit
    /// sentinel, or the custom sentinel.
    private func modelSelection(selected: ModelPickerSelection) -> Binding<String> {
        Binding(
            get: {
                switch selected {
                case .inherit: return ModelConfigOption.inherit
                case .custom: return ModelConfigOption.custom
                case .catalog(let spec): return spec
                case .orphan(let spec): return spec
                }
            },
            set: { newValue in
                let spec: String
                switch newValue {
                case ModelConfigOption.inherit:
                    // Mirrors onPick: picking Inherit stores '' and lets the
                    // host decide what that inherits from.
                    spec = ""
                case ModelConfigOption.custom:
                    // Mirrors onPick: Custom… stores `custom:<draft model>`
                    // immediately; saving the endpoint refines it.
                    spec = customSpec(model: draftModel)
                default:
                    spec = newValue
                }
                value = spec
            }
        )
    }

    private var budgetBinding: Binding<Double?> {
        Binding(
            get: { budget },
            set: { newValue in
                budget = newValue
                onBudgetChange?(newValue)
            }
        )
    }

    // MARK: Catalog loading (the `catalog-url` attribute)

    private func loadCatalog() async {
        guard let catalogURL, catalog.isEmpty else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: catalogURL)
            let json = try JSONDecoder().decode(JSONValue.self, from: data)
            loaded = parseCatalogEntries(json)
        } catch is DecodingError {
            catalogError = "Catalog format not understood."
        } catch {
            // Deliberately terse: the error text is user-facing and the URL
            // carries no secrets, but the failure is surfaced, not swallowed.
            catalogError = "Could not load catalog."
        }
    }
}

/// The `custom-endpoint-save` detail. An empty `apiKey` means "keep the
/// stored key" — never log any of it.
public struct CustomEndpointSave: Sendable, Hashable {
    public var baseUrl: String
    public var model: String
    public var apiKey: String

    public init(baseUrl: String, model: String, apiKey: String) {
        self.baseUrl = baseUrl
        self.model = model
        self.apiKey = apiKey
    }
}

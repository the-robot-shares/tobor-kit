import Foundation
import ToborKitCore

/// Swift mirror of `model-config/catalog.ts` — the pure semantics of the
/// `<noizu-model-config>` island, kept behavior-identical:
///
/// - The host persists (e.g. TRK `GET`/`PATCH` `/api/v1/ai/settings`); the
///   view never stores secrets and never logs keys — a masked echo
///   (`••••1234`) is data, not a saveable key.
/// - `""` is the *inherit* value; `custom:<spec>` marks a custom selection;
///   a value that matches no catalog entry renders as an *orphan* option
///   rather than disappearing.
/// - Empty or masked API-key input means "keep the stored key": the save
///   event carries `apiKey: ""` and the host must not overwrite.

/// Sentinel option values, mirroring `INHERIT_OPTION` / `CUSTOM_OPTION`.
public enum ModelConfigOption {
    public static let inherit = "__inherit__"
    public static let custom = "__custom__"
}

/// Sentinel values, mirroring `INHERIT_VALUE` / `CUSTOM_PREFIX`.
public enum ModelConfigValue {
    public static let inherit = "inherit"
    public static let customPrefix = "custom:"
}

/// One catalog entry (`provider` + `model` at minimum).
public struct ModelCatalogEntry: Sendable, Hashable, Identifiable {
    public var provider: String
    public var model: String
    /// Optional display label; falls back to the spec.
    public var label: String?
    /// Exact spec to store; defaults to `provider:model`.
    public var spec: String?

    public init(provider: String, model: String, label: String? = nil, spec: String? = nil) {
        self.provider = provider
        self.model = model
        self.label = label
        self.spec = spec
    }

    public var id: String { specOf(self) }
}

/// The spec a host stores for an entry: the explicit `spec` when present,
/// else `provider:model`.
public func specOf(_ entry: ModelCatalogEntry) -> String {
    let spec = entry.spec?.trimmingCharacters(in: .whitespaces) ?? ""
    return spec.isEmpty ? "\(entry.provider):\(entry.model)" : spec
}

/// `""` or `inherit` means inherit.
public func isInheritValue(_ value: String) -> Bool {
    value.isEmpty || value == ModelConfigValue.inherit
}

/// A `custom:`-prefixed selection.
public func isCustomValue(_ value: String) -> Bool {
    value.hasPrefix(ModelConfigValue.customPrefix)
}

/// The spec behind a `custom:` selection.
public func customSpec(_ value: String) -> String {
    String(value.dropFirst(ModelConfigValue.customPrefix.count))
}

/// The spec the host stores for a custom endpoint: `custom:<model>` (empty
/// model degrades to the bare prefix — mirrors `customSpec()` in catalog.ts).
public func customSpec(model: String) -> String {
    let trimmed = model.trimmingCharacters(in: .whitespaces)
    return trimmed.isEmpty ? "custom" : ModelConfigValue.customPrefix + trimmed
}

/// Detects a masked echo (`••••1234`, `***abc`, `xxxx`) — never a real key.
public func isMaskedSecret(_ value: String) -> Bool {
    let v = value.trimmingCharacters(in: .whitespaces)
    guard !v.isEmpty else { return false }
    if v.contains("•") { return true }
    if v.hasPrefix("***") { return true }
    if v.count >= 4, v.lowercased().hasPrefix("xxxx") { return true }
    return false
}

/// Empty or masked input means "keep the stored key": the result is `""` and
/// the host must not overwrite. Callers must not log the input.
public func apiKeyForSave(_ typed: String) -> String {
    let v = typed.trimmingCharacters(in: .whitespaces)
    if v.isEmpty || isMaskedSecret(v) { return "" }
    return v
}

/// An OpenAI-compatible custom endpoint (may carry a masked `apiKey` echo).
public struct CustomEndpoint: Sendable, Hashable {
    public var baseUrl: String
    public var model: String
    /// Plaintext or masked echo (`••••1234`). Never log.
    public var apiKey: String?

    public init(baseUrl: String, model: String, apiKey: String? = nil) {
        self.baseUrl = baseUrl
        self.model = model
        self.apiKey = apiKey
    }
}

/// The payload a host's catalog endpoint returns.
public struct CatalogPayload: Sendable, Hashable {
    public var entries: [ModelCatalogEntry]
    public var custom: CustomEndpoint?

    public init(entries: [ModelCatalogEntry], custom: CustomEndpoint? = nil) {
        self.entries = entries
        self.custom = custom
    }
}

/// Parses a catalog GET response: a bare array, or an object carrying the
/// array under `catalog`, `models`, or `entries`; the custom endpoint under
/// `custom` / `customEndpoint` / `custom_endpoint`. Unknown shapes yield an
/// empty payload rather than an error — the picker still renders custom.
public func parseCatalogPayload(_ data: JSONValue) -> CatalogPayload {
    CatalogPayload(
        entries: parseCatalogEntries(data),
        custom: parseCustomEndpoint(data)
    )
}

public func parseCatalogEntries(_ data: JSONValue) -> [ModelCatalogEntry] {
    let raw: [JSONValue]
    if case .array(let items) = data {
        raw = items
    } else if case .object = data {
        raw = data["catalog"]?.arrayValue
            ?? data["models"]?.arrayValue
            ?? data["entries"]?.arrayValue
            ?? []
    } else {
        raw = []
    }
    return raw.compactMap { entry in
        guard case .object = entry else { return nil }
        let provider = entry["provider"]?.stringValue.trimmed ?? ""
        let model = entry["model"]?.stringValue.trimmed ?? ""
        guard !provider.isEmpty, !model.isEmpty else { return nil }
        return ModelCatalogEntry(
            provider: provider,
            model: model,
            label: entry["label"]?.stringValue.trimmed,
            spec: entry["spec"]?.stringValue.trimmed
        )
    }
}

public func parseCustomEndpoint(_ data: JSONValue) -> CustomEndpoint? {
    guard case .object = data else { return nil }
    let customOpt = data["custom"] ?? data["customEndpoint"] ?? data["custom_endpoint"]
    guard case .object(let custom) = customOpt else { return nil }
    let baseUrl = custom["baseUrl"]?.stringValue.trimmed
        ?? custom["base_url"]?.stringValue.trimmed
    let model = custom["model"]?.stringValue.trimmed
    let apiKey = custom["apiKey"]?.stringValue.trimmed
        ?? custom["api_key"]?.stringValue.trimmed
    if (baseUrl ?? "").isEmpty && (model ?? "").isEmpty && (apiKey ?? "").isEmpty {
        return nil
    }
    return CustomEndpoint(baseUrl: baseUrl ?? "", model: model ?? "", apiKey: apiKey)
}

/// The picker's resolved selection state — the Swift counterpart of the
/// element's `selectValue()` / `isCustomSelection()` / `orphanOption()` trio.
public enum ModelPickerSelection: Equatable {
    /// The Inherit option is showing and selected.
    case inherit
    /// The Custom… option is showing and selected (value was `custom:` or
    /// matched no catalog entry).
    case custom
    /// A catalog entry (or a plain stored value) is selected by spec.
    case catalog(String)
    /// A stored value that matches no catalog entry — rendered as an extra
    /// option so the host's value is never silently lost.
    case orphan(String)

    public static func resolve(
        value: String,
        inherit: Bool,
        allowCustom: Bool,
        entries: [ModelCatalogEntry]
    ) -> ModelPickerSelection {
        let isKnown = entries.contains { specOf($0) == value }
        if inherit && isInheritValue(value) { return .inherit }
        if allowCustom && (isCustomValue(value) || (!isInheritValue(value) && !isKnown)) {
            // An orphan value with custom allowed selects the Custom… option,
            // exactly like `isCustomSelection()` does.
            return .custom
        }
        if isInheritValue(value) { return .catalog("") }
        return isKnown ? .catalog(value) : .orphan(value)
    }
}

private extension String? {
    var trimmed: String? {
        guard let self else { return nil }
        let t = self.trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? nil : t
    }
}

private extension JSONValue {
    var arrayValue: [JSONValue]? {
        if case .array(let a) = self { return a }
        return nil
    }
}

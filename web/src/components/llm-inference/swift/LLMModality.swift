import Foundation

/// What a provider *produces* — a second, orthogonal axis to
/// ``LLMProvider/Group`` (which says where a provider runs: cloud /
/// proxyLocal / advanced). The TS twin is `LLMModality` in `catalog.ts`;
/// the Hologram twin is `Catalog.modalities/0`.
///
/// Optional on the descriptor: an entry that declares nothing is `.text`,
/// so every pre-modality catalog keeps its exact behaviour.
public enum LLMModality: String, Sendable, Hashable, Codable, CaseIterable {
    case text
    case image
    case audio
    case speech
    case video

    /// Section heading text (the picker renders it as `── Image ──`).
    public var label: String {
        switch self {
        case .text: return "Text"
        case .image: return "Image"
        case .audio: return "Audio"
        case .speech: return "Speech"
        case .video: return "Video"
        }
    }

    /// The disabled section row the modality-sectioned picker shows.
    public var sectionTitle: String { "── \(label) ──" }

    /// What a descriptor without declared modalities means.
    public static let implicitDefault: [LLMModality] = [.text]
}

extension LLMProvider {
    /// Declared modalities, defaulted: nil or empty ⇒ `[.text]`.
    public var effectiveModalities: [LLMModality] {
        guard let modalities, !modalities.isEmpty else { return LLMModality.implicitDefault }
        return modalities
    }

    /// Whether this provider produces the given modality (text by default).
    public func supports(_ modality: LLMModality) -> Bool {
        effectiveModalities.contains(modality)
    }

    /// Catalog slice for one modality, in catalog order.
    public static func providers(in catalog: [LLMProvider] = LLMProvider.catalog, matching modality: LLMModality) -> [LLMProvider] {
        catalog.filter { $0.supports(modality) }
    }

    /// Whether any entry declares modalities — i.e. sectioning by them is
    /// meaningful for this catalog.
    public static func declaresModalities(in catalog: [LLMProvider] = LLMProvider.catalog) -> Bool {
        catalog.contains { !($0.modalities ?? []).isEmpty }
    }

    /// Modalities present in a catalog, in `LLMModality.allCases` order.
    public static func modalities(in catalog: [LLMProvider] = LLMProvider.catalog) -> [LLMModality] {
        LLMModality.allCases.filter { modality in catalog.contains { $0.supports(modality) } }
    }
}

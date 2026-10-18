import SwiftUI
import ToborKitCore

/// The guide's `ui.theme` map, resolved against SwiftUI colors.
///
/// The schema carries CSS custom property overrides (`--tobor-accent` etc.);
/// the same keys map onto this token set, per the guide-definition's note that
/// Swift maps the keys onto its own tokens. Unknown keys are ignored rather
/// than guessed at — a web-only token must not silently restyle the Swift
/// panel.
public struct ToborTheme: Sendable, Hashable {

    public var accent: Color
    public var surface: Color
    public var surfaceAlt: Color

    /// Token defaults; the config-provided values win when present.
    public static let `default` = ToborTheme(
        accent: Color(red: 0.486, green: 0.361, blue: 1.0),   // #7c5cff
        surface: Color(red: 0.071, green: 0.071, blue: 0.102), // #12121a
        surfaceAlt: Color(red: 0.12, green: 0.12, blue: 0.16)
    )

    public init(accent: Color, surface: Color, surfaceAlt: Color) {
        self.accent = accent
        self.surface = surface
        self.surfaceAlt = surfaceAlt
    }

    /// Resolves the projection's theme map. The map is additive-property style
    /// CSS values (`#7c5cff`, `#rgb`, named colors); hex is parsed here, named
    /// colors fall back to the default token.
    public init(theme: [String: String]) {
        self = ToborTheme.default
        if let value = theme["--tobor-accent"], let color = Color(toborHex: value) { accent = color }
        if let value = theme["--tobor-surface"], let color = Color(toborHex: value) { surface = color }
        if let value = theme["--tobor-surface-2"], let color = Color(toborHex: value) { surfaceAlt = color }
    }
}

extension Color {
    /// Parses `#rrggbb`, `#rgb`, and `#rrggbbaa`.
    init?(toborHex: String) {
        var text = toborHex.trimmingCharacters(in: .whitespaces)
        guard text.hasPrefix("#") else { return nil }
        text.removeFirst()
        var channels: [Double] = []
        if text.count == 3 {
            channels = text.compactMap { $0.hexDigitValue.map { Double($0 * 17) } }
            guard channels.count == 3 else { return nil }
        } else if text.count == 6 || text.count == 8 {
            var bytes: [UInt8] = []
            var iterator = text.makeIterator()
            while let high = iterator.next(), let low = iterator.next() {
                guard let highValue = high.hexDigitValue, let lowValue = low.hexDigitValue else { return nil }
                bytes.append(UInt8(highValue * 16 + lowValue))
            }
            guard bytes.count >= 3 else { return nil }
            channels = bytes.prefix(3).map(Double.init)
            if bytes.count == 8 { channels.append(Double(bytes[3]) / 255.0) }
        } else {
            return nil
        }
        guard channels.count >= 3 else { return nil }
        self.init(
            .sRGB,
            red: channels[0] / 255.0,
            green: channels[1] / 255.0,
            blue: channels[2] / 255.0,
            opacity: channels.count > 3 ? channels[3] : 1.0
        )
    }
}

/// Environment injection so every view in the panel reads the same tokens.
private struct ToborThemeKey: EnvironmentKey {
    static let defaultValue: ToborTheme = .default
}

extension EnvironmentValues {
    public var toborTheme: ToborTheme {
        get { self[ToborThemeKey.self] }
        set { self[ToborThemeKey.self] = newValue }
    }
}

extension View {
    public func toborTheme(_ theme: ToborTheme) -> some View {
        environment(\.toborTheme, theme)
    }
}

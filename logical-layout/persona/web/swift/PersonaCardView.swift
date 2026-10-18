import SwiftUI
import ToborKitCore

/// Swift mirror of `tobor-persona-card` / `tobor-persona-picker`
/// (`web/src/components/persona/`).
///
/// The **host supplies the persona list**; selecting is a callback — never
/// navigation, never a fetch, exactly like the lit island. The card embeds
/// the robot avatar as its default identity mark, mirroring the lit slot
/// default (`<tobor-robot-avatar slot="avatar">`).

/// One roster entry — `{id, name, handle?}` in the lit picker.
public struct PersonaIdentity: Sendable, Hashable, Identifiable {
    public var id: String
    public var name: String
    public var handle: String?

    public init(id: String, name: String, handle: String? = nil) {
        self.id = id
        self.name = name
        self.handle = handle
    }
}

/// The identity card: avatar + display name + handle, with an optional live
/// state driving the avatar (the lit card shows a static `state` attribute;
/// here the same seven-state machine drives it).
public struct PersonaCardView: View {

    public let persona: PersonaIdentity
    /// Current guide state for the avatar; `nil` renders the static idle face.
    public let state: GuideState?
    public let theme: ToborTheme

    public init(
        persona: PersonaIdentity,
        state: GuideState? = nil,
        theme: ToborTheme = .default
    ) {
        self.persona = persona
        self.state = state
        self.theme = theme
    }

    public var body: some View {
        HStack(spacing: 12) {
            if let state {
                RobotAvatarView(renderer: .glyph, state: state, theme: theme)
                    .frame(width: 44, height: 44)
            } else {
                RobotAvatarView(renderer: .glyph, state: .idle, theme: theme)
                    .frame(width: 44, height: 44)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(persona.name)
                    .font(.headline)
                if let handle = persona.handle, !handle.isEmpty {
                    Text(handle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(theme.surface.opacity(0.35), in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(persona.name)\(persona.handle.map { " \($0)" } ?? "")")
    }
}

/// The searchable picker over the host-supplied roster (the lit
/// `tobor-persona-picker` with its `query` attribute + `personas` property).
public struct PersonaPickerView: View {

    public let personas: [PersonaIdentity]
    @State private var query: String
    public let onSelect: (PersonaIdentity) -> Void

    public init(
        personas: [PersonaIdentity],
        query: String = "",
        onSelect: @escaping (PersonaIdentity) -> Void
    ) {
        self.personas = personas
        self._query = State(initialValue: query)
        self.onSelect = onSelect
    }

    /// Case-insensitive substring match over name, handle, and id — the same
    /// fields the lit picker filters.
    private var filtered: [PersonaIdentity] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return personas }
        return personas.filter { persona in
            persona.name.lowercased().contains(q)
                || (persona.handle?.lowercased().contains(q) ?? false)
                || persona.id.lowercased().contains(q)
        }
    }

    public var body: some View {
        List(filtered) { persona in
            Button {
                onSelect(persona)
            } label: {
                PersonaCardView(persona: persona)
            }
            .buttonStyle(.plain)
        }
        .overlay {
            if filtered.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
        .searchable(text: $query, prompt: "Filter personas")
    }
}

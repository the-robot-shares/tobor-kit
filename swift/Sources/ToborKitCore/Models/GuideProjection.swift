import Foundation

/// The `GET /guide` payload.
///
/// This is a *projection*, not the guide definition. The compiled NPL preamble,
/// the agent biography, provider model ids and every credential stay on the
/// server. Nothing in this file should ever grow a field carrying prompt text —
/// if it does, the contract has been violated somewhere upstream.
public struct GuideProjection: Sendable, Codable, Hashable {

    public var slug: String
    public var name: String
    public var title: String?
    public var greeting: String?

    /// Content hash of the compiled prompt bundle in use. Echo it in bug
    /// reports; it is how a stale deploy gets identified.
    public var bundleHash: String?

    public var capabilities: [Capability]
    public var modes: [GuideMode]
    public var defaultMode: GuideMode?
    public var ui: UI
    public var auth: Auth
    public var telemetry: TelemetrySettings
    public var voice: VoiceSettings
    public var transcript: TranscriptSettings

    public init(
        slug: String,
        name: String,
        title: String? = nil,
        greeting: String? = nil,
        bundleHash: String? = nil,
        capabilities: [Capability] = [],
        modes: [GuideMode] = [],
        defaultMode: GuideMode? = nil,
        ui: UI = UI(),
        auth: Auth = Auth(),
        telemetry: TelemetrySettings = TelemetrySettings(),
        voice: VoiceSettings = VoiceSettings(),
        transcript: TranscriptSettings = TranscriptSettings()
    ) {
        self.slug = slug
        self.name = name
        self.title = title
        self.greeting = greeting
        self.bundleHash = bundleHash
        self.capabilities = capabilities
        self.modes = modes
        self.defaultMode = defaultMode
        self.ui = ui
        self.auth = auth
        self.telemetry = telemetry
        self.voice = voice
        self.transcript = transcript
    }

    private enum CodingKeys: String, CodingKey {
        case slug, name, title, greeting
        case bundleHash = "bundle_hash"
        case capabilities, modes
        case defaultMode = "default_mode"
        case ui, auth, telemetry, voice, transcript
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        slug = try c.decode(String.self, forKey: .slug)
        name = try c.decode(String.self, forKey: .name)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        greeting = try c.decodeIfPresent(String.self, forKey: .greeting)
        bundleHash = try c.decodeIfPresent(String.self, forKey: .bundleHash)
        capabilities = try c.decodeIfPresent([Capability].self, forKey: .capabilities) ?? []
        // Unknown mode strings are dropped rather than failing the whole
        // projection: a server that grows a fourth mode must not brick an
        // older client that simply cannot render it.
        modes = (try c.decodeIfPresent([LenientMode].self, forKey: .modes) ?? [])
            .compactMap(\.value)
        defaultMode = (try c.decodeIfPresent(LenientMode.self, forKey: .defaultMode))?.value
        ui = try c.decodeIfPresent(UI.self, forKey: .ui) ?? UI()
        auth = try c.decodeIfPresent(Auth.self, forKey: .auth) ?? Auth()
        telemetry = try c.decodeIfPresent(TelemetrySettings.self, forKey: .telemetry) ?? TelemetrySettings()
        voice = try c.decodeIfPresent(VoiceSettings.self, forKey: .voice) ?? VoiceSettings()
        transcript = try c.decodeIfPresent(TranscriptSettings.self, forKey: .transcript) ?? TranscriptSettings()
    }

    /// The mode a fresh panel opens in: the declared default when it is one the
    /// guide actually offers, else the first offered mode, else `.text`.
    public var resolvedDefaultMode: GuideMode {
        if let defaultMode, modes.isEmpty || modes.contains(defaultMode) { return defaultMode }
        return modes.first ?? .text
    }

    // MARK: - Nested shapes

    public struct Capability: Sendable, Codable, Hashable, Identifiable {
        public var id: String
        public var description: String?

        public init(id: String, description: String? = nil) {
            self.id = id
            self.description = description
        }
    }

    public struct UI: Sendable, Codable, Hashable {
        public var robot: Robot
        public var panel: Panel
        public var theme: [String: String]

        public init(robot: Robot = Robot(), panel: Panel = Panel(), theme: [String: String] = [:]) {
            self.robot = robot
            self.panel = panel
            self.theme = theme
        }

        private enum CodingKeys: String, CodingKey { case robot, panel, theme }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            robot = try c.decodeIfPresent(Robot.self, forKey: .robot) ?? Robot()
            panel = try c.decodeIfPresent(Panel.self, forKey: .panel) ?? Panel()
            theme = try c.decodeIfPresent([String: String].self, forKey: .theme) ?? [:]
        }
    }

    public struct Robot: Sendable, Codable, Hashable {
        public var renderer: RobotRenderer
        public var asset: String?
        /// Per-state animation hints, keyed by ``GuideState`` raw value.
        public var states: [String: StateAnimation]
        public var reducedMotion: ReducedMotionPolicy

        public init(
            renderer: RobotRenderer = .glyph,
            asset: String? = nil,
            states: [String: StateAnimation] = [:],
            reducedMotion: ReducedMotionPolicy = .respect
        ) {
            self.renderer = renderer
            self.asset = asset
            self.states = states
            self.reducedMotion = reducedMotion
        }

        private enum CodingKeys: String, CodingKey {
            case renderer, asset, states
            case reducedMotion = "reduced_motion"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            // An unknown renderer falls back to `glyph`, which needs no assets
            // and therefore always renders something.
            renderer = (try c.decodeIfPresent(String.self, forKey: .renderer))
                .flatMap(RobotRenderer.init(rawValue:)) ?? .glyph
            asset = try c.decodeIfPresent(String.self, forKey: .asset)
            states = try c.decodeIfPresent([String: StateAnimation].self, forKey: .states) ?? [:]
            reducedMotion = (try c.decodeIfPresent(String.self, forKey: .reducedMotion))
                .flatMap(ReducedMotionPolicy.init(rawValue:)) ?? .respect
        }

        public func animation(for state: GuideState) -> StateAnimation {
            states[state.rawValue] ?? StateAnimation()
        }
    }

    public struct StateAnimation: Sendable, Codable, Hashable {
        public var segment: String?
        public var loop: Bool
        public var speed: Double

        public init(segment: String? = nil, loop: Bool = true, speed: Double = 1.0) {
            self.segment = segment
            self.loop = loop
            self.speed = speed
        }

        private enum CodingKeys: String, CodingKey { case segment, loop, speed }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            segment = try c.decodeIfPresent(String.self, forKey: .segment)
            loop = try c.decodeIfPresent(Bool.self, forKey: .loop) ?? true
            speed = try c.decodeIfPresent(Double.self, forKey: .speed) ?? 1.0
        }
    }

    public struct Panel: Sendable, Codable, Hashable {
        public var placement: PanelPlacement
        public var startExpanded: Bool
        public var showToolList: Bool
        public var showTaskMenu: Bool

        public init(
            placement: PanelPlacement = .floating,
            startExpanded: Bool = false,
            showToolList: Bool = true,
            showTaskMenu: Bool = true
        ) {
            self.placement = placement
            self.startExpanded = startExpanded
            self.showToolList = showToolList
            self.showTaskMenu = showTaskMenu
        }

        private enum CodingKeys: String, CodingKey {
            case placement
            case startExpanded = "start_expanded"
            case showToolList = "show_tool_list"
            case showTaskMenu = "show_task_menu"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            placement = (try c.decodeIfPresent(String.self, forKey: .placement))
                .flatMap(PanelPlacement.init(rawValue:)) ?? .floating
            startExpanded = try c.decodeIfPresent(Bool.self, forKey: .startExpanded) ?? false
            // Schema default (`ui.panel.show_tool_list: true`).
            showToolList = try c.decodeIfPresent(Bool.self, forKey: .showToolList) ?? true
            showTaskMenu = try c.decodeIfPresent(Bool.self, forKey: .showTaskMenu) ?? true
        }
    }

    public struct Auth: Sendable, Codable, Hashable {
        public var required: Bool
        public var provider: AuthProvider
        public var issuer: String?
        public var clientID: String?
        public var scopes: [String]
        public var redirectPath: String?

        public init(
            required: Bool = true,
            provider: AuthProvider = .oidc,
            issuer: String? = nil,
            clientID: String? = nil,
            scopes: [String] = ["openid", "email", "profile"],
            redirectPath: String? = nil
        ) {
            self.required = required
            self.provider = provider
            self.issuer = issuer
            self.clientID = clientID
            self.scopes = scopes
            self.redirectPath = redirectPath
        }

        private enum CodingKeys: String, CodingKey {
            case required, provider, issuer
            case clientID = "client_id"
            case scopes
            case redirectPath = "redirect_path"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            required = try c.decodeIfPresent(Bool.self, forKey: .required) ?? true
            provider = (try c.decodeIfPresent(String.self, forKey: .provider))
                .flatMap(AuthProvider.init(rawValue:)) ?? .oidc
            issuer = try c.decodeIfPresent(String.self, forKey: .issuer)
            clientID = try c.decodeIfPresent(String.self, forKey: .clientID)
            scopes = try c.decodeIfPresent([String].self, forKey: .scopes) ?? []
            redirectPath = try c.decodeIfPresent(String.self, forKey: .redirectPath)
        }
    }

    /// Enough for the consent toggle to render correctly before any API call.
    /// The *resolved* value still comes from `GET /telemetry/consent`.
    public struct TelemetrySettings: Sendable, Codable, Hashable {
        public var enabled: Bool
        public var `default`: TelemetryDefault
        public var userOverridable: Bool

        public init(
            enabled: Bool = false,
            default defaultValue: TelemetryDefault = .on,
            userOverridable: Bool = true
        ) {
            self.enabled = enabled
            self.default = defaultValue
            self.userOverridable = userOverridable
        }

        private enum CodingKeys: String, CodingKey {
            case enabled
            case `default`
            case userOverridable = "user_overridable"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            enabled = try c.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
            // Schema default (`telemetry.default: on` — the opt-out posture).
            `default` = (try c.decodeIfPresent(String.self, forKey: .default))
                .flatMap(TelemetryDefault.init(rawValue:)) ?? .on
            userOverridable = try c.decodeIfPresent(Bool.self, forKey: .userOverridable) ?? true
        }
    }

    public struct VoiceSettings: Sendable, Codable, Hashable {
        public var adapter: VoiceAdapterKind
        public var pushToTalk: Bool
        public var mintPath: String?
        public var locale: String?

        public init(
            adapter: VoiceAdapterKind = .realtime,
            pushToTalk: Bool = false,
            mintPath: String? = nil,
            locale: String? = nil
        ) {
            self.adapter = adapter
            self.pushToTalk = pushToTalk
            self.mintPath = mintPath
            self.locale = locale
        }

        private enum CodingKeys: String, CodingKey {
            case adapter
            case pushToTalk = "push_to_talk"
            case mintPath = "mint_path"
            case locale
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            // Schema default (`voice.adapter: realtime`). The UI still gates
            // voice on `modes` containing `.voice`, so a guide that never
            // intended voice is safe; this default only matters when it did.
            adapter = (try c.decodeIfPresent(String.self, forKey: .adapter))
                .flatMap(VoiceAdapterKind.init(rawValue:)) ?? .realtime
            pushToTalk = try c.decodeIfPresent(Bool.self, forKey: .pushToTalk) ?? false
            mintPath = try c.decodeIfPresent(String.self, forKey: .mintPath)
            locale = try c.decodeIfPresent(String.self, forKey: .locale)
        }
    }

    public struct TranscriptSettings: Sendable, Codable, Hashable {
        public var store: TranscriptStoreKind
        public var retainTurns: Int?

        public init(store: TranscriptStoreKind = .memory, retainTurns: Int? = nil) {
            self.store = store
            self.retainTurns = retainTurns
        }

        private enum CodingKeys: String, CodingKey {
            case store
            case retainTurns = "retain_turns"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            store = (try c.decodeIfPresent(String.self, forKey: .store))
                .flatMap(TranscriptStoreKind.init(rawValue:)) ?? .memory
            retainTurns = try c.decodeIfPresent(Int.self, forKey: .retainTurns)
        }
    }
}

// MARK: - Enumerations

public enum GuideMode: String, Sendable, Codable, CaseIterable, Hashable {
    case voice, text, transcript
}

public enum RobotRenderer: String, Sendable, Codable, CaseIterable, Hashable {
    case lottie, sprite, glyph
}

public enum ReducedMotionPolicy: String, Sendable, Codable, CaseIterable, Hashable {
    case respect
    case forceStatic = "force_static"
    case ignore
}

public enum PanelPlacement: String, Sendable, Codable, CaseIterable, Hashable {
    case floating, docked, inline
}

public enum AuthProvider: String, Sendable, Codable, CaseIterable, Hashable {
    case oidc, authentik, none
}

public enum TelemetryDefault: String, Sendable, Codable, CaseIterable, Hashable {
    case on, off
}

public enum VoiceAdapterKind: String, Sendable, Codable, CaseIterable, Hashable {
    case realtime, native, backend, none
}

public enum TranscriptStoreKind: String, Sendable, Codable, CaseIterable, Hashable {
    case memory, local, backend
}

/// Decodes a mode string without failing on values this build has never heard of.
private struct LenientMode: Decodable {
    let value: GuideMode?
    init(from decoder: any Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        value = GuideMode(rawValue: raw)
    }
}

/// Un-nested alias — the avatar API reads better without the qualifying type.
public typealias StateAnimation = GuideProjection.StateAnimation

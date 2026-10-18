import Foundation

public struct GuideSession: Sendable, Codable, Hashable, Identifiable {
    public var id: UUID
    public var createdAt: Date
    public var state: GuideState
    public var turnCount: Int
    /// Null when `auth.required` is false and the session is bound to an opaque
    /// client id rather than a user.
    public var user: User?

    public init(
        id: UUID,
        createdAt: Date,
        state: GuideState,
        turnCount: Int = 0,
        user: User? = nil
    ) {
        self.id = id
        self.createdAt = createdAt
        self.state = state
        self.turnCount = turnCount
        self.user = user
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"
        case state
        case turnCount = "turn_count"
        case user
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        state = try c.decode(GuideState.self, forKey: .state)
        turnCount = try c.decodeIfPresent(Int.self, forKey: .turnCount) ?? 0
        user = try c.decodeIfPresent(User.self, forKey: .user)
    }

    public struct User: Sendable, Codable, Hashable {
        public var id: String?
        public var email: String?
        public var displayName: String?

        public init(id: String? = nil, email: String? = nil, displayName: String? = nil) {
            self.id = id
            self.email = email
            self.displayName = displayName
        }

        private enum CodingKeys: String, CodingKey {
            case id, email
            case displayName = "display_name"
        }
    }
}

/// Body of `POST /sessions`.
public struct CreateSessionRequest: Sendable, Codable, Hashable {
    public var resumeID: UUID?
    public var locale: String?
    public var client: ClientKind?

    public init(resumeID: UUID? = nil, locale: String? = "en-US", client: ClientKind? = .current) {
        self.resumeID = resumeID
        self.locale = locale
        self.client = client
    }

    private enum CodingKeys: String, CodingKey {
        case resumeID = "resume_id"
        case locale, client
    }

    public enum ClientKind: String, Sendable, Codable, Hashable {
        case web, ios, macos, other

        /// What this build should report. The contract has no `visionos` or
        /// `tvos` member, so anything else declares itself `other` rather than
        /// lying about being a phone.
        public static var current: ClientKind {
            #if os(iOS)
            return .ios
            #elseif os(macOS)
            return .macos
            #else
            return .other
            #endif
        }
    }
}

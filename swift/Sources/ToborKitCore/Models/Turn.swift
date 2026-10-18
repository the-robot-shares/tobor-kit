import Foundation

public struct Turn: Sendable, Codable, Hashable, Identifiable {
    public var id: UUID
    public var role: Role
    public var content: String
    public var createdAt: Date
    public var toolCalls: [ToolCallRecord]
    public var usage: Usage?

    public init(
        id: UUID,
        role: Role,
        content: String,
        createdAt: Date,
        toolCalls: [ToolCallRecord] = [],
        usage: Usage? = nil
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
        self.toolCalls = toolCalls
        self.usage = usage
    }

    private enum CodingKeys: String, CodingKey {
        case id, role, content
        case createdAt = "created_at"
        case toolCalls = "tool_calls"
        case usage
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        role = try c.decode(Role.self, forKey: .role)
        content = try c.decode(String.self, forKey: .content)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        toolCalls = try c.decodeIfPresent([ToolCallRecord].self, forKey: .toolCalls) ?? []
        usage = try c.decodeIfPresent(Usage.self, forKey: .usage)
    }

    public enum Role: String, Sendable, Codable, Hashable {
        case user, assistant, system
    }

    public struct ToolCallRecord: Sendable, Codable, Hashable, Identifiable {
        public var id: String
        public var name: String?
        public var ok: Bool?
        public var summary: String?

        public init(id: String, name: String? = nil, ok: Bool? = nil, summary: String? = nil) {
            self.id = id
            self.name = name
            self.ok = ok
            self.summary = summary
        }
    }

    public struct Usage: Sendable, Codable, Hashable {
        public var inputTokens: Int?
        public var outputTokens: Int?

        public init(inputTokens: Int? = nil, outputTokens: Int? = nil) {
            self.inputTokens = inputTokens
            self.outputTokens = outputTokens
        }

        private enum CodingKeys: String, CodingKey {
            case inputTokens = "input_tokens"
            case outputTokens = "output_tokens"
        }
    }
}

/// Body of `POST /sessions/{id}/turn`.
public struct CreateTurnRequest: Sendable, Codable, Hashable {
    public var input: String
    /// Names an MCP tool the guide should prefer, when the turn came from the
    /// task menu. Advisory — the guide may still decline.
    public var taskID: String?
    public var idempotencyKey: String?

    public init(input: String, taskID: String? = nil, idempotencyKey: String? = nil) {
        self.input = input
        self.taskID = taskID
        self.idempotencyKey = idempotencyKey
    }

    private enum CodingKeys: String, CodingKey {
        case input
        case taskID = "task_id"
        case idempotencyKey = "idempotency_key"
    }
}

/// `GET /sessions/{id}/transcript` — only meaningful for the `backend` store.
public struct TranscriptPage: Sendable, Codable, Hashable {
    public var turns: [Turn]
    public var hasMore: Bool

    public init(turns: [Turn] = [], hasMore: Bool = false) {
        self.turns = turns
        self.hasMore = hasMore
    }

    private enum CodingKeys: String, CodingKey {
        case turns
        case hasMore = "has_more"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        turns = try c.decodeIfPresent([Turn].self, forKey: .turns) ?? []
        hasMore = try c.decodeIfPresent(Bool.self, forKey: .hasMore) ?? false
    }
}

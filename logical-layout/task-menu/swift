import Foundation

/// One entry from `GET /mcp/tools`, already dressed by the server's `mcp.menu`
/// overlay.
///
/// Clients render this verbatim. Re-applying the overlay client-side is exactly
/// the drift this kit exists to prevent, so there is deliberately no
/// label/group/order rewriting anywhere in ToborKit.
public struct Tool: Sendable, Codable, Hashable, Identifiable {
    /// Fully-qualified MCP tool name, e.g. `Github.PullCreate`. Also the id.
    public var name: String
    public var label: String
    public var description: String?
    public var group: String
    public var icon: String?
    public var server: String?
    /// The client must obtain explicit confirmation before invoking.
    public var confirm: Bool
    /// From the tool's own `read_only_hint` annotation, when present.
    public var readOnly: Bool?
    /// JSON Schema for arguments. Present in the tool list, omitted from the
    /// menu view — kept as raw JSON because the kit never interprets it.
    public var inputSchema: JSONValue?

    public var id: String { name }

    public init(
        name: String,
        label: String,
        description: String? = nil,
        group: String,
        icon: String? = nil,
        server: String? = nil,
        confirm: Bool = false,
        readOnly: Bool? = nil,
        inputSchema: JSONValue? = nil
    ) {
        self.name = name
        self.label = label
        self.description = description
        self.group = group
        self.icon = icon
        self.server = server
        self.confirm = confirm
        self.readOnly = readOnly
        self.inputSchema = inputSchema
    }

    private enum CodingKeys: String, CodingKey {
        case name, label, description, group, icon, server, confirm
        case readOnly = "read_only"
        case inputSchema = "input_schema"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        label = try c.decode(String.self, forKey: .label)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        group = try c.decode(String.self, forKey: .group)
        icon = try c.decodeIfPresent(String.self, forKey: .icon)
        server = try c.decodeIfPresent(String.self, forKey: .server)
        confirm = try c.decodeIfPresent(Bool.self, forKey: .confirm) ?? false
        readOnly = try c.decodeIfPresent(Bool.self, forKey: .readOnly)
        inputSchema = try c.decodeIfPresent(JSONValue.self, forKey: .inputSchema)
    }
}

public struct ToolGroup: Sendable, Codable, Hashable, Identifiable {
    public var id: String
    public var label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }
}

/// A server the inventory could not reach.
///
/// The contract carries these so the UI can *say so* rather than silently
/// presenting a short list as if it were complete.
public struct DegradedServer: Sendable, Codable, Hashable, Identifiable {
    public var server: String?
    public var error: String?

    public var id: String { server ?? error ?? "unknown" }

    public init(server: String? = nil, error: String? = nil) {
        self.server = server
        self.error = error
    }
}

public struct ToolInventory: Sendable, Codable, Hashable {
    public var groups: [ToolGroup]
    public var tools: [Tool]
    public var degraded: [DegradedServer]

    public init(groups: [ToolGroup] = [], tools: [Tool] = [], degraded: [DegradedServer] = []) {
        self.groups = groups
        self.tools = tools
        self.degraded = degraded
    }

    private enum CodingKeys: String, CodingKey { case groups, tools, degraded }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        groups = try c.decodeIfPresent([ToolGroup].self, forKey: .groups) ?? []
        tools = try c.decodeIfPresent([Tool].self, forKey: .tools) ?? []
        degraded = try c.decodeIfPresent([DegradedServer].self, forKey: .degraded) ?? []
    }

    /// True when at least one configured server failed to answer, meaning the
    /// list on screen is incomplete.
    public var isDegraded: Bool { !degraded.isEmpty }

    /// Tools bucketed by the server-declared groups, in the server's order.
    /// Tools whose `group` matches no declared group are returned last under a
    /// synthesised group so nothing silently disappears from the menu.
    public func sections() -> [(group: ToolGroup, tools: [Tool])] {
        var sections: [(group: ToolGroup, tools: [Tool])] = groups.map { group in
            (group, tools.filter { $0.group == group.id })
        }
        let known = Set(groups.map(\.id))
        let orphans = tools.filter { !known.contains($0.group) }
        if !orphans.isEmpty {
            sections.append((ToolGroup(id: "_other", label: "Other"), orphans))
        }
        return sections.filter { !$0.tools.isEmpty }
    }
}

import Foundation
import ToborKitCore

/// One pending confirmation for a `confirm: true` tool from the task menu.
/// Shaped after robocalc's `ApprovalQueue` — the same queue-then-decide flow.
public struct ToolApprovalRequest: Identifiable, Equatable, Sendable {
    public var id = UUID()
    public var toolName: String
    public var label: String
    public var summary: String

    public init(toolName: String, label: String, summary: String) {
        self.toolName = toolName
        self.label = label
        self.summary = summary
    }
}

/// Queues confirmation requests for tools the server flagged `confirm: true`.
///
/// The confirmation is a client duty the contract assigns explicitly ("Client
/// must obtain explicit confirmation before invoking") — this queue is where
/// the panel discharges it, and a tool never dispatches without a decision
/// having been drawn from here.
@MainActor
@Observable
public final class ToolApprovalQueue {

    public private(set) var pending: [ToolApprovalRequest] = []

    public init() {}

    public func submit(_ request: ToolApprovalRequest) {
        pending.append(request)
    }

    /// Removes and answers the request. Returns the request so the caller can
    /// carry its identity into the turn, or `nil` when the id is stale.
    @discardableResult
    public func decide(id: UUID, approve: Bool) -> ToolApprovalRequest? {
        guard let index = pending.firstIndex(where: { $0.id == id }) else { return nil }
        let request = pending.remove(at: index)
        return approve ? request : nil
    }
}

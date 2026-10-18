import SwiftUI
import ToborKitCore

/// Swift mirror of `tobor-task-menu`'s chip strip — a compact horizontal
/// run of task chips grouped by the server's declared groups, with the
/// degraded servers surfaced inline.
///
/// Contract rules carried over from the lit element:
/// - The inventory renders **verbatim** (`GET /mcp/tools` after the server's
///   `mcp.menu` overlay). No label/group/order rewriting lives here.
/// - `degraded[]` is *shown*, never dropped: a short list must not pass as
///   complete.
/// - Selection emits the tool name — the `tobor-task-invoked`
///   `{ task_id }` detail — and the host decides what runs.
public struct TaskQueueStripView: View {

    public let inventory: ToolInventory
    public let theme: ToborTheme
    /// Mirrors `tobor-task-invoked` — carries the tool name as task id.
    public let onInvoke: ((String) -> Void)?

    public init(
        inventory: ToolInventory,
        theme: ToborTheme = .default,
        onInvoke: ((String) -> Void)? = nil
    ) {
        self.inventory = inventory
        self.theme = theme
        self.onInvoke = onInvoke
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if inventory.isDegraded {
                degradedNotice
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(inventory.sections(), id: \.group.id) { section in
                        ForEach(section.tools) { tool in
                            chip(tool)
                        }
                    }
                }
                .padding(.vertical, 1)
            }
            .overlay(alignment: .trailing) {
                // A soft edge hinting the strip scrolls rather than truncating.
                LinearGradient(
                    colors: [theme.surface.opacity(0.8), .clear],
                    startPoint: .leading, endPoint: .trailing
                )
                .frame(width: 18)
                .allowsHitTesting(false)
                .opacity(inventory.tools.count > 4 ? 1 : 0)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Task menu")
    }

    private func chip(_ tool: Tool) -> some View {
        Button {
            onInvoke?(tool.name)
        } label: {
            HStack(spacing: 5) {
                if tool.confirm {
                    Image(systemName: "hand.raised.fill")
                        .font(.caption2)
                        .foregroundStyle(theme.accent)
                        .accessibilityLabel("Requires confirmation")
                }
                Text(tool.label)
                    .lineLimit(1)
            }
            .font(.callout)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(theme.surfaceAlt, in: Capsule())
        }
        .buttonStyle(.plain)
        .help(tool.description ?? tool.label)
        .accessibilityHint(tool.confirm ? "Confirmation required before running" : "")
    }

    private var degradedNotice: some View {
        Label {
            Text("Some servers are unreachable — the list may be incomplete: "
                 + inventory.degraded.compactMap(\.server).joined(separator: ", "))
        } icon: {
            Image(systemName: "exclamationmark.triangle.fill")
        }
        .font(.caption)
        .foregroundStyle(.orange)
    }
}

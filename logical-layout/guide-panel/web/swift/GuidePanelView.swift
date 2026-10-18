import SwiftUI
import ToborKitCore

/// The floating guide companion: a peek/expand avatar with a conversation
/// panel, shaped after robocalc's `VoiceCompanionView` (peek height, spring
/// expand, avatar button first).
///
/// Everything rendered here comes from the config projection — modes, task
/// menu, tool list, telemetry toggle, degraded banner — and nothing is
/// inferred or re-dressed client-side.
public struct GuidePanelView: View {

    @State private var model: GuideModel
    @State private var expanded: Bool = false
    @State private var draft: String = ""
    @FocusState private var composerFocused: Bool

    private let peekHeight: CGFloat = 72
    private let expandedWidth: CGFloat = 320

    public init(model: GuideModel) {
        _model = State(initialValue: model)
    }

    public var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            if !model.approvals.pending.isEmpty {
                approvalStack
            }
            if expanded {
                panel
                    .frame(width: expandedWidth)
                    .transition(.scale(scale: 0.9, anchor: .bottom).combined(with: .opacity))
            }
            avatarButton
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.82), value: expanded)
        .task { await model.load() }
    }

    // MARK: Avatar

    private var avatarButton: some View {
        Button {
            expanded.toggle()
        } label: {
            RobotAvatarView(
                renderer: model.projection?.ui.robot.renderer ?? .glyph,
                state: model.state,
                animation: model.projection?.ui.robot.animation(for: model.state) ?? StateAnimation(),
                reducedMotion: model.projection?.ui.robot.reducedMotion ?? .respect,
                theme: theme
            )
            .frame(width: 56, height: 56)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Tobor guide")
        .help(expanded ? "Hide the guide" : "Talk with the guide")
    }

    // MARK: Panel

    private var panel: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
            if let inventory = model.inventory, inventory.isDegraded {
                degradedBanner(inventory)
            }
            if model.transcriptNotBackendStored {
                transcriptNotice
            }
            transcriptList
            if !composerHidden {
                composer
            }
        }
        .background(theme.surface.opacity(0.96))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(theme.accent.opacity(0.25), lineWidth: 1)
        )
        .toborTheme(theme)
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(model.projection?.name ?? "Guide")
                    .font(.headline)
                if let title = model.projection?.title {
                    Text(title)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if model.showsTelemetryToggle {
                TelemetryConsentToggle(model: model)
            }
            modePicker
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    /// Mode toggles render only for the modes the guide declares, in the
    /// declaration's display order.
    private var modePicker: some View {
        Picker("Mode", selection: $model.mode) {
            ForEach(availableModes, id: \.self) { mode in
                Text(mode.rawValue.capitalized).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .frame(maxWidth: 170)
    }

    private var availableModes: [GuideMode] {
        let declared = model.projection?.modes ?? []
        return declared.isEmpty ? [.text] : declared
    }

    private var composerHidden: Bool {
        // Voice mode listens instead of typing; transcript mode is read-only.
        guard model.projection != nil else { return false }
        switch model.mode {
        case .text: return false
        case .voice: return true
        case .transcript: return true
        }
    }

    // MARK: Transcript

    private var transcriptList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    if let greeting = model.projection?.greeting {
                        Text(greeting)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .padding(.bottom, 4)
                    }
                    ForEach(model.entries) { entry in
                        TranscriptRow(entry: entry)
                            .id(entry.id)
                    }
                    if let lastError = model.lastError {
                        Text(lastError)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                .padding(12)
            }
            .onChange(of: model.entries.count) { _, count in
                if let last = model.entries.last {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
        }
        .frame(minHeight: 180, maxHeight: 360)
    }

    private var transcriptNotice: some View {
        Label("This guide keeps its history on this device.", systemImage: "info.circle")
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
    }

    private func degradedBanner(_ inventory: ToolInventory) -> some View {
        // `degraded[]` is surfaced, never dropped: the list on screen is
        // incomplete and the user is told so.
        VStack(alignment: .leading, spacing: 2) {
            ForEach(inventory.degraded) { degraded in
                Label(
                    "\(degraded.server ?? "A tool server") is unreachable — the tool list may be short.",
                    systemImage: "exclamationmark.triangle"
                )
                .font(.caption)
                .foregroundStyle(.orange)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }

    // MARK: Composer

    private var composer: some View {
        HStack(spacing: 8) {
            if model.projection?.ui.panel.showTaskMenu ?? true {
                taskMenu
            }
            TextField("Message", text: $draft, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...4)
                .focused($composerFocused)
                .disabled(model.state.isBusy)
                .onSubmit { Task { await submit() } }
            Button {
                Task { await submit() }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title3)
            }
            .buttonStyle(.plain)
            .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty || model.state.isBusy)
            .accessibilityLabel("Send")
        }
        .padding(12)
    }

    /// The task menu: a view over the *dressed* inventory. No label, group or
    /// ordering is rewritten here — that is the server's `mcp.menu` overlay's
    /// job, and re-applying it is the drift this kit prevents.
    private var taskMenu: some View {
        Menu {
            if let inventory = model.inventory {
                ForEach(inventory.sections(), id: \.group.id) { section in
                    Section(section.group.label) {
                        ForEach(section.tools) { tool in
                            Button(tool.label) {
                                enqueue(tool: tool)
                            }
                        }
                    }
                }
                if inventory.isDegraded {
                    Section {
                        Text("Some tool servers are unreachable")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                Text("Tools loading…")
            }
        } label: {
            Image(systemName: "list.bullet.circle")
                .font(.title3)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .accessibilityLabel("Task menu")
    }

    private func enqueue(tool: Tool) {
        guard tool.confirm else {
            draft = "Please use \(tool.name)."
            Task { await submit(taskID: tool.name) }
            return
        }
        model.approvals.submit(ToolApprovalRequest(
            toolName: tool.name,
            label: tool.label,
            summary: tool.description ?? tool.label
        ))
    }

    private func submit(taskID: String? = nil) async {
        let text = draft
        draft = ""
        try? await model.send(text, taskID: taskID ?? pendingTaskID)
        pendingTaskID = nil
    }

    @State private var pendingTaskID: String?

    // MARK: Approvals

    private var approvalStack: some View {
        VStack(spacing: 6) {
            ForEach(model.approvals.pending) { request in
                VStack(alignment: .leading, spacing: 6) {
                    Text(request.label).font(.subheadline.weight(.semibold))
                    Text(request.summary).font(.caption).foregroundStyle(.secondary)
                    HStack {
                        Button("Approve") {
                            if let approved = model.approvals.decide(id: request.id, approve: true) {
                                pendingTaskID = approved.toolName
                                Task { await submit(taskID: approved.toolName) }
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        Button("Deny") {
                            _ = model.approvals.decide(id: request.id, approve: false)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(10)
                .frame(width: expandedWidth - 24, alignment: .leading)
                .background(theme.surface.opacity(0.96))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    private var theme: ToborTheme {
        ToborTheme(theme: model.projection?.ui.theme ?? [:])
    }
}

// MARK: - Rows

struct TranscriptRow: View {
    let entry: GuideTranscriptEntry

    var body: some View {
        switch entry.speaker {
        case .user:
            HStack {
                Spacer(minLength: 32)
                Text(entry.text)
                    .padding(10)
                    .background(Color.accentColor.opacity(0.18))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        case .assistant:
            Text(entry.text)
                .padding(.trailing, 24)
        case .toolCall:
            Label(entry.text, systemImage: "wrench.and.screwdriver")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
        case .toolResult:
            Label(entry.text, systemImage: "checkmark.circle")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.leading, 14)
        }
    }
}

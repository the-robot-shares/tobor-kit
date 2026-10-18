/**
 * `<tobor-guide-panel>` — the orchestrator. Drop it in a page, give it a
 * client (or just a base URL), and it renders the whole guide surface:
 *
 *   header(avatar, name, title) · mode toggle · body(text input | voice
 *   session | transcript) · task menu · tool list · telemetry toggle
 *
 * The panel consumes ONLY the config projection from `GET /guide`. The
 * compiled NPL preamble never reaches this code — anything the UI needed was
 * projected into the response, and anything prompt-shaped stays server-side.
 *
 * Turn flow: POST /sessions/{id}/turn streams SSE; the `state` event drives
 * the avatar, `delta` accumulates the pending bubble, and the guaranteed
 * single terminal `message`/`error` finalizes the turn. A stream that closes
 * without one surfaces `stream_incomplete` — the avatar never spins forever.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {property, state} from "lit/decorators.js";

import { toborKitControls, toborKitTokens, applyThemeVars } from "../mode-toggle/theme.js";
import { emit } from "../../events.js";
import { ToborKitClient } from "../../client.js";
import { storeForGuide, type TranscriptLoad, type TranscriptStore } from "../transcript-view/transcript-store.js";
import type {
  GuideProjection,
  GuideState,
  ToolInventory,
  Turn,
} from "../../types.js";
import "../robot-avatar/robot-avatar.js";
import "../mode-toggle/mode-toggle.js";
import "../voice-session/voice-session.js";
import "../transcript-view/transcript-view.js";
import "../task-menu/task-menu.js";
import "../tool-list/tool-list.js";
import "../telemetry-toggle/telemetry-toggle.js";
import {defineElement} from '../../define.js';

@defineElement("tobor-guide-panel")
export class ToborGuidePanel extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      :host([placement="floating"]) {
        position: fixed;
        right: 20px;
        bottom: 20px;
        width: var(--tobor-kit-panel-width, 360px);
        z-index: 1000;
      }

      :host([placement="docked"]),
      :host([placement="inline"]) {
        width: 100%;
        max-width: var(--tobor-kit-panel-width, 480px);
      }

      .panel {
        background: var(--_bg);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        box-shadow: var(--_shadow);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: var(--_gap);
      }

      header {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      header h1 {
        font-size: 1em;
        margin: 0;
      }

      header .title {
        font-size: 0.8em;
        color: var(--_muted);
      }

      header tobor-robot-avatar {
        width: 52px;
        height: 52px;
        flex: none;
      }

      .header-actions {
        margin-left: auto;
        display: flex;
        gap: 6px;
      }

      .greeting {
        color: var(--_muted);
        font-size: 0.9em;
        margin: 0;
      }

      form {
        display: flex;
        gap: 6px;
      }

      input[type="text"] {
        flex: 1;
        font: inherit;
        color: inherit;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 8px 10px;
      }

      footer {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8em;
      }

      footer .spacer {
        flex: 1;
      }

      .error {
        margin: 0;
      }
    `,
  ];

  /** Config projection. Fetched via the client on connect when omitted. */
  @property({ attribute: false })
  guide?: GuideProjection;

  /** API client. Built from `baseUrl`/`token` when omitted. */
  @property({ attribute: false })
  client?: ToborKitClient;

  @property({ type: String })
  baseUrl?: string;

  @property({ type: String })
  token?: string;

  @property({ type: String, reflect: true })
  placement: "floating" | "docked" | "inline" = "floating";

  @property({ type: Boolean, attribute: "start-expanded" })
  startExpanded = false;

  @state()
  private _expanded = false;

  @state()
  private _session: { id: string } | null = null;

  @state()
  private _mode: "voice" | "text" | "transcript" = "text";

  @state()
  private _state: GuideState = "idle";

  @state()
  private _turns: Turn[] = [];

  @state()
  private _pending = "";

  @state()
  private _error: { code: string; message: string } | null = null;

  @state()
  private _inventory: ToolInventory | null = null;

  @state()
  private _transcriptLoad: TranscriptLoad | null = null;

  @state()
  private _showTools = false;

  private _store: TranscriptStore | null = null;
  private _busy = false;
  private _pendingTaskId: string | null = null;
  private _pendingTaskLabel: string | null = null;
  #inputValue = "";

  override connectedCallback(): void {
    super.connectedCallback();
    void this.#init();
  }

  async #init(): Promise<void> {
    const client = this.#ensureClient();
    try {
      this.guide = this.guide ?? (await client.getGuide());
    } catch (err) {
      this._error = {
        code: "guide_unavailable",
        message: err instanceof Error ? err.message : String(err),
      };
      return;
    }
    this._expanded = this.guide.ui?.panel?.start_expanded ?? this.startExpanded;
    applyThemeVars(this, this.guide.ui?.theme);
    this.placement = this.guide.ui?.panel?.placement ?? this.placement;
    this._mode = this.guide.default_mode ?? this.guide.modes[0] ?? "text";
    if (this.guide.ui?.panel?.show_task_menu !== false || this.guide.ui?.panel?.show_tool_list !== false) {
      void this.#loadInventory();
    }
    if (this._mode === "transcript") void this.#loadTranscript();
  }

  #ensureClient(): ToborKitClient {
    if (!this.client) {
      this.client = new ToborKitClient({
        baseUrl: this.baseUrl,
        token: this.token ? () => this.token ?? null : undefined,
      });
    }
    return this.client;
  }

  get #panel(): NonNullable<GuideProjection["ui"]["panel"]> {
    return this.guide?.ui?.panel ?? {};
  }

  override render(): TemplateResult {
    if (!this.guide) {
      return html`
        <div class="panel" part="panel">
          ${this._error
            ? html`<p class="notice notice--error error" data-testid="panel-error">
                ${this._error.message}
              </p>`
            : html`<p class="muted" data-testid="panel-loading">Loading guide…</p>`}
        </div>
      `;
    }

    return html`
      <div class="panel" part="panel">
        <header part="header">
          <tobor-robot-avatar
            .state=${this._state}
            .renderer=${this.guide.ui?.robot?.renderer ?? "glyph"}
            .asset=${this.guide.ui?.robot?.asset}
            .states=${this.guide.ui?.robot?.states}
            .reducedMotion=${this.guide.ui?.robot?.reduced_motion ?? "respect"}
            .label=${this.guide.name}
          ></tobor-robot-avatar>
          <div>
            <h1>${this.guide.name}</h1>
            ${this.guide.title ? html`<div class="title">${this.guide.title}</div>` : nothing}
          </div>
          <div class="header-actions">
            ${this.#panel.show_task_menu !== false
              ? html`<tobor-task-menu
                  .inventory=${this._inventory}
                  @tobor-task-select=${this.#onTaskSelect}
                ></tobor-task-menu>`
              : nothing}
            ${this.#panel.show_tool_list !== false
              ? html`<button
                  data-testid="tools-toggle"
                  aria-expanded=${this._showTools ? "true" : "false"}
                  @click=${() => (this._showTools = !this._showTools)}
                >
                  Tools
                </button>`
              : nothing}
          </div>
        </header>

        ${this._expanded
          ? html`
              ${this.guide.greeting
                ? html`<p class="greeting" data-testid="greeting">${this.guide.greeting}</p>`
                : nothing}
              ${this._error && this._error.code !== "guide_unavailable"
                ? html`<p class="notice notice--error error" data-testid="turn-error">
                    ${this._error.message}
                  </p>`
                : nothing}
              ${this._showTools
                ? html`<tobor-tool-list .inventory=${this._inventory}></tobor-tool-list>`
                : nothing}
              ${this.#body()}
              <tobor-mode-toggle
                .modes=${this.guide.modes}
                .mode=${this._mode}
                .disabled=${this._busy}
                @tobor-mode-change=${(e: CustomEvent<{ mode: "voice" | "text" | "transcript" }>) =>
                  this.#onModeChange(e.detail.mode)}
              ></tobor-mode-toggle>
            `
          : nothing}

        <footer part="footer">
          <tobor-telemetry-toggle .client=${this.#ensureClient()}></tobor-telemetry-toggle>
          <span class="spacer"></span>
          ${this._expanded
            ? html`<button data-testid="collapse" @click=${() => (this._expanded = false)}>
                Collapse
              </button>`
            : html`<button data-testid="expand" @click=${() => (this._expanded = true)}>
                Open
              </button>`}
        </footer>
      </div>
    `;
  }

  #body(): TemplateResult {
    switch (this._mode) {
      case "voice":
        return html`<tobor-voice-session
          .client=${this.#ensureClient()}
          .voice=${this.guide?.voice}
          .pushToTalk=${this.guide?.voice?.push_to_talk ?? false}
          @tobor-voice-state=${(e: CustomEvent<{ state: GuideState }>) => this.#onVoiceState(e.detail.state)}
          @tobor-voice-transcript=${(e: CustomEvent<{ entry: { speaker: string; text: string } }>) =>
            this.#onVoiceTranscript(e.detail.entry)}
        ></tobor-voice-session>`;
      case "transcript":
        return html`<tobor-transcript-view
          .turns=${this._turns}
          .load=${this._transcriptLoad}
          .store=${this._store ?? undefined}
          @tobor-transcript-clear=${() => {
            this._turns = [];
            this._transcriptLoad = null;
          }}
        ></tobor-transcript-view>`;
      default:
        return html`
          <form
            @submit=${(e: Event) => {
              e.preventDefault();
              void this.#submit(this.#inputValue);
            }}
          >
            <input
              type="text"
              data-testid="text-input"
              placeholder=${this._pendingTaskLabel
                ? `Ask about: ${this._pendingTaskLabel}`
                : "Ask the guide…"}
              .value=${this.#inputValue}
              ?disabled=${this._busy}
              @input=${(e: InputEvent) => (this.#inputValue = (e.target as HTMLInputElement).value)}
            />
            <button type="submit" data-testid="send" ?disabled=${this._busy}>Send</button>
          </form>
        `;
    }
  }

  /* ------------------------------------------------------------- actions */

  /** Open a session lazily; the projection's transcript store rides along. */
  async #ensureSession(): Promise<string> {
    if (this._session) return this._session.id;
    const client = this.#ensureClient();
    const session = await client.createSession({ client: "web" });
    this._session = session;
    this._store = storeForGuide({
      store: this.guide?.transcript?.store,
      retain_turns: this.guide?.transcript?.retain_turns,
      client,
      sessionId: session.id,
      slug: this.guide?.slug,
    });
    return session.id;
  }

  async #loadInventory(): Promise<void> {
    try {
      this._inventory = await this.#ensureClient().listTools();
    } catch {
      this._inventory = { groups: [], tools: [], degraded: [] };
    }
  }

  async #loadTranscript(): Promise<void> {
    if (!this._store) return;
    const result = await this._store.load();
    this._transcriptLoad = result;
    if (result.status === "ok") this._turns = result.turns;
  }

  async #onModeChange(mode: "voice" | "text" | "transcript"): Promise<void> {
    this._mode = mode;
    if (mode === "transcript") await this.#loadTranscript();
  }

  #onTaskSelect(e: CustomEvent<{ tool: { name: string; label: string } }>): void {
    // task_id is advisory: it names a tool the guide should prefer next turn.
    this._pendingTaskId = e.detail.tool.name;
    this._pendingTaskLabel = e.detail.tool.label;
    emit(this, "tobor-task-invoked", { task_id: e.detail.tool.name });
    this._expanded = true;
  }

  #onVoiceState(state: GuideState): void {
    this._state = state;
  }

  #onVoiceTranscript(entry: { speaker: string; text: string }): void {
    if (entry.speaker === "user" && entry.text) void this.#submit(entry.text);
  }

  /** Submit a user turn and consume the SSE stream. */
  async #submit(input: string): Promise<void> {
    const text = input.trim();
    if (!text || this._busy || !this.guide) return;
    const client = this.#ensureClient();
    this._busy = true;
    this._error = null;
    this._pending = "";
    emit(this, "tobor-turn-submitted", { input: text, task_id: this._pendingTaskId ?? undefined });

    try {
      const sessionId = await this.#ensureSession();
      let usageTurn: Turn | null = null;
      const toolCalls: { id?: string; name?: string; ok?: boolean; summary?: string }[] = [];

      await client.streamTurn(
        sessionId,
        {
          input: text,
          task_id: this._pendingTaskId ?? undefined,
          idempotency_key:
            globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        {
          onState: (state) => {
            this._state = state;
            emit(this, "tobor-state-change", { state });
          },
          onDelta: (delta) => {
            this._pending += delta;
          },
          onToolCall: (call) => {
            this._state = "tool_running";
            toolCalls.push({ id: call.id, name: call.name });
          },
          onToolResult: (result) => {
            const call = toolCalls.find((c) => c.id === result.id);
            if (call) {
              call.ok = result.ok;
              call.summary = result.summary;
            }
          },
          onMessage: (turn) => {
            usageTurn = turn;
          },
          onError: (error) => {
            this._error = error;
            this._state = "error";
            emit(this, "tobor-turn-error", { error });
          },
        },
      );

      if (usageTurn) {
        this._turns = [...this._turns, usageTurn];
        this._state = "idle";
        emit(this, "tobor-turn-message", { turn: usageTurn });
        await this._store?.append(usageTurn);
      }
    } catch (err) {
      this._error = {
        code: "turn_failed",
        message: err instanceof Error ? err.message : String(err),
      };
      this._state = "error";
      emit(this, "tobor-turn-error", { error: this._error });
    } finally {
      this._busy = false;
      this._pending = "";
      this._pendingTaskId = null;
      this._pendingTaskLabel = null;
      this.#inputValue = "";
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-guide-panel": ToborGuidePanel;
  }
}

/**
 * `<tobor-voice-session>` — the mic button and the voice adapter host.
 *
 * The element is a thin wrapper over `createVoiceAdapter`: whatever the
 * projection's `voice.adapter` names is what runs. Adapter progress arrives
 * already translated to canonical `GuideState` values, so this element and
 * `<tobor-robot-avatar>` speak the same vocabulary.
 *
 * Events up:
 * - `tobor-voice-state`     `{ state: GuideState }`
 * - `tobor-voice-transcript` `{ entry: VoiceTranscriptEntry }`
 * - `tobor-voice-error`     `{ error: { code, message } }`
 */

import { LitElement, css, html, type TemplateResult } from "lit";
import {property, state} from "lit/decorators.js";

import { toborKitControls, toborKitTokens } from "../mode-toggle/theme.js";
import { emit } from "../../events.js";
import type { ToborKitClient } from "../../client.js";
import type { GuideState, GuideVoice } from "../../types.js";
import {
  createVoiceAdapter,
  type VoiceAdapter,
  type VoiceAdapterHooks,
  type VoiceTranscriptEntry,
} from "./adapter.js";
import {defineElement} from '../../define.js';

const STATE_LABEL: Record<GuideState, string> = {
  idle: "Voice off",
  listening: "Listening",
  thinking: "Connecting",
  speaking: "Speaking",
  tool_running: "Working",
  error: "Voice error",
  offline: "Unavailable",
};

@defineElement("tobor-voice-session")
export class ToborVoiceSession extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .mic {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      .mic[aria-pressed="true"] {
        background: var(--_accent);
        color: var(--_accent-fg);
        border-color: var(--_accent);
      }

      .status {
        font-size: 0.85em;
        color: var(--_muted);
        min-width: 70px;
      }

      .status[data-state="error"] {
        color: var(--_danger);
      }
    `,
  ];

  @property({ attribute: false })
  client?: ToborKitClient;

  /** The projection's `voice` block — names the adapter and its options. */
  @property({ attribute: false })
  voice?: GuideVoice;

  /** From `voice.push_to_talk`. Hold-to-talk when true, click-to-toggle otherwise. */
  @property({ type: Boolean, attribute: "push-to-talk" })
  pushToTalk = false;

  /** Test seam: override adapter construction. */
  @property({ attribute: false })
  adapterFactory: typeof createVoiceAdapter = createVoiceAdapter;

  @state()
  private _state: GuideState = "idle";

  @state()
  private _active = false;

  #adapter: VoiceAdapter | null = null;

  override disconnectedCallback(): void {
    this.#adapter?.stop().catch(() => undefined);
    this.#adapter = null;
    super.disconnectedCallback();
  }

  override render(): TemplateResult {
    return html`
      <button
        class="mic"
        part="mic"
        data-testid="voice-mic"
        aria-pressed=${this._active ? "true" : "false"}
        aria-label=${this._active ? "Stop voice session" : "Start voice session"}
        @click=${this.pushToTalk ? undefined : () => void this.#toggle()}
        @pointerdown=${this.pushToTalk ? (e: PointerEvent) => this.#holdStart(e) : undefined}
        @pointerup=${this.pushToTalk ? () => void this.stop() : undefined}
        @pointerleave=${this.pushToTalk ? () => void this.stop() : undefined}
      >
        ${this._active ? "◼" : "●"}
      </button>
      <span class="status" data-testid="voice-status" data-state=${this._state} part="status">
        ${STATE_LABEL[this._state] ?? this._state}
      </span>
    `;
  }

  /** Start talking. Resolves even when the adapter fails (state reports it). */
  async start(): Promise<void> {
    if (this._active || !this.client) return;
    const hooks: VoiceAdapterHooks = {
      onState: (state) => {
        this._state = state;
        emit(this, "tobor-voice-state", { state });
      },
      onTranscript: (entry: VoiceTranscriptEntry) => {
        emit(this, "tobor-voice-transcript", { entry });
      },
      onError: (error) => {
        emit(this, "tobor-voice-error", { error });
      },
    };
    this.#adapter = this.adapterFactory({
      voice: this.voice,
      client: this.client,
      hooks,
      audioHost: this,
    });
    await this.#adapter.start();
    this._active = this.#adapter.active;
    if (!this._active) this._state = this.#adapter.active ? this._state : "idle";
  }

  async stop(): Promise<void> {
    await this.#adapter?.stop();
    this.#adapter = null;
    this._active = false;
    this._state = "idle";
  }

  /** Forward typed text through the voice channel (realtime adapters allow it). */
  sendText(text: string): void {
    this.#adapter?.sendText(text);
  }

  async #toggle(): Promise<void> {
    if (this._active) await this.stop();
    else await this.start();
  }

  #holdStart(e: PointerEvent): void {
    e.preventDefault();
    void this.start();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-voice-session": ToborVoiceSession;
  }
}

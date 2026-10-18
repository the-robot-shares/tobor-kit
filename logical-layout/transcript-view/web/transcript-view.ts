/**
 * `<tobor-transcript-view>` — the conversation log.
 *
 * Three visually distinct render states, because collapsing them hides real
 * information:
 *
 * - turns present            → the log
 * - empty turns              → "nothing said yet"
 * - `not_server_backed` load → the server keeps no copy (GET /transcript
 *   answered 501). NOT an error, NOT an empty transcript.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {property, state} from "lit/decorators.js";

import { toborKitControls, toborKitTokens } from "../mode-toggle/theme.js";
import { emit } from "../../events.js";
import type { TranscriptLoad, TranscriptStore } from "./transcript-store.js";
import type { Turn } from "../../types.js";
import {defineElement} from '../../define.js';

@defineElement("tobor-transcript-view")
export class ToborTranscriptView extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      [role="log"] {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: var(--tobor-kit-transcript-height, 360px);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-right: 2px;
      }

      .turn {
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        padding: 8px 10px;
        max-width: 92%;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .turn[data-role="user"] {
        align-self: flex-end;
        background: var(--_accent);
        color: var(--_accent-fg);
        border-color: var(--_accent);
      }

      .turn[data-role="assistant"] {
        align-self: flex-start;
        background: var(--_surface);
      }

      .turn[data-role="system"] {
        align-self: stretch;
        color: var(--_muted);
        font-size: 0.85em;
      }

      .tools {
        font-size: 0.8em;
        color: var(--_muted);
        margin-top: 6px;
        border-top: 1px dashed var(--_border);
        padding-top: 4px;
      }

      .empty,
      .not-backed {
        color: var(--_muted);
        font-size: 0.9em;
        padding: 10px 4px;
      }

      .not-backed {
        border: 1px dashed var(--_border);
        border-radius: var(--_radius);
      }

      footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 6px;
      }

      button {
        font-size: 0.8em;
      }
    `,
  ];

  /** Turns to render. Ignored while a `load` outcome says otherwise. */
  @property({ attribute: false })
  turns: Turn[] = [];

  /** Outcome of a backend store load — carries the 501 distinction. */
  @property({ attribute: false })
  load?: TranscriptLoad | null;

  /** Present → a clear affordance renders and works. */
  @property({ attribute: false })
  store?: TranscriptStore;

  /** Streaming text not yet finalized into a turn. */
  @property({ type: String })
  pending = "";

  @state()
  private _clearing = false;

  override render(): TemplateResult {
    if (this.load && this.load.status === "not_server_backed") {
      return html`
        <div class="not-backed" data-testid="not-server-backed" part="notice">
          This guide keeps its transcript on this device — the server stores no copy.
        </div>
      `;
    }

    if (!this.turns.length && !this.pending) {
      return html`
        <div class="empty" data-testid="transcript-empty" part="empty">Nothing said yet.</div>
      `;
    }

    return html`
      <div role="log" aria-label="Conversation transcript" part="log">
        ${this.turns.map((t) => this.#turn(t))}
        ${this.pending
          ? html`<div class="turn" data-role="assistant" data-testid="pending-turn">
              ${this.pending}
            </div>`
          : nothing}
      </div>
      ${this.store
        ? html`
            <footer>
              <button
                data-testid="transcript-clear"
                ?disabled=${this._clearing}
                @click=${() => void this.#clear()}
              >
                Clear transcript
              </button>
            </footer>
          `
        : nothing}
    `;
  }

  #turn(turn: Turn): TemplateResult {
    return html`
      <div class="turn" data-role=${turn.role} data-turn-id=${turn.id} part="turn">
        ${turn.content}
        ${turn.tool_calls?.length
          ? html`
              <div class="tools" data-testid="turn-tools">
                ${turn.tool_calls.map(
                  (c) => html`<div>${c.ok === false ? "✗" : "✓"} ${c.name ?? "tool"}${c.summary ? ` — ${c.summary}` : ""}</div>`,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  async #clear(): Promise<void> {
    this._clearing = true;
    try {
      await this.store?.clear();
      this.turns = [];
      this.load = null;
      emit(this, "tobor-transcript-clear", {});
    } finally {
      this._clearing = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-transcript-view": ToborTranscriptView;
  }
}

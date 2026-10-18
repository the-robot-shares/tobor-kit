/**
 * `<tobor-chat-thread>` — a conversation thread that generalizes
 * `<tobor-transcript-view>` instead of forking a second log.
 *
 * Inner view owns empty / not-server-backed / pending / clear. This host adds
 * a participant roster, optional composer (`thread-send`), and a `messages`
 * alias that maps onto `Turn[]` with timestamps and participant names baked
 * into plain text (Lit escapes markup; the inner log pre-wraps; no unsafeHTML).
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {property, state} from "lit/decorators.js";

import { emit } from "../../events.js";
import type { Turn } from "../../types.js";
import { toborKitControls, toborKitTokens } from "../mode-toggle/theme.js";
import type { TranscriptLoad, TranscriptStore } from "../transcript-view/transcript-store.js";
import "../transcript-view/transcript-view.js";
import {defineElement} from '../../define.js';

const TURN_ROLES = new Set<Turn["role"]>(["user", "assistant", "system"]);

export interface ChatThreadMessage {
  id?: string;
  role: string;
  text: string;
  at?: string;
  participant?: string;
}

export interface ChatThreadParticipant {
  id: string;
  name: string;
}

export interface ThreadSendDetail {
  text: string;
}

/** Untrusted HTML stays characters (escaped by Lit). `**bold**` is left as source. */
export function threadPlainText(text: string): string {
  return text;
}

export function messagesToTurns(
  messages: ChatThreadMessage[],
  participants: ChatThreadParticipant[] = [],
): Turn[] {
  return messages.map((message, index) => {
    const name = participantName(message.participant, participants);
    const stamp = formatStamp(message.at);
    const meta = [stamp, name].filter(Boolean).join(" · ");
    const body = threadPlainText(message.text);
    return {
      id: message.id || `thread-${index}`,
      role: coerceRole(message.role),
      content: meta ? `${meta}\n${body}` : body,
      created_at: message.at || "",
    };
  });
}

function coerceRole(role: string): Turn["role"] {
  return TURN_ROLES.has(role as Turn["role"]) ? (role as Turn["role"]) : "user";
}

function participantName(id: string | undefined, participants: ChatThreadParticipant[]): string {
  if (!id) return "";
  return participants.find((row) => row.id === id)?.name ?? id;
}

function formatStamp(at: string | undefined): string {
  if (!at) return "";
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return at;
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

@defineElement("tobor-chat-thread")
export class ToborChatThread extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .thread {
        display: flex;
        flex-direction: column;
        gap: var(--_gap);
      }

      .participants {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 0.85em;
        color: var(--_muted);
      }

      .participant {
        border: 1px solid var(--_border);
        border-radius: 999px;
        padding: 2px 8px;
      }

      form {
        display: flex;
        gap: 6px;
        align-items: flex-end;
      }

      textarea {
        flex: 1;
        font: inherit;
        color: inherit;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 8px 10px;
        resize: vertical;
        min-height: 2.5em;
        white-space: pre-wrap;
      }
    `,
  ];

  /** Turns forwarded to the inner transcript view. Ignored when `messages` is nonempty. */
  @property({ attribute: false })
  turns: Turn[] = [];

  /**
   * Alias for `turns`. `{id?, role, text, at?, participant?}` maps onto `Turn`
   * with timestamp + participant name prefixed as plain text.
   */
  @property({ attribute: false })
  messages: ChatThreadMessage[] = [];

  @property({ attribute: false })
  participants: ChatThreadParticipant[] = [];

  @property({ attribute: false })
  load?: TranscriptLoad | null;

  @property({ attribute: false })
  store?: TranscriptStore;

  /** Streaming assistant chunk not yet a turn. */
  @property({ type: String })
  pending = "";

  /** When true, the composer renders and can emit `thread-send`. */
  @property({ type: Boolean, attribute: "show-composer" })
  showComposer = false;

  @state()
  private _draft = "";

  override render(): TemplateResult {
    return html`
      <div class="thread" data-cy="thread.root" part="root">
        ${this.participants.length
          ? html`
              <ul class="participants" part="participants">
                ${this.participants.map(
                  (row) => html`<li class="participant" part="participant">${row.name}</li>`,
                )}
              </ul>
            `
          : nothing}
        <tobor-transcript-view
          .turns=${this.#viewTurns()}
          .load=${this.load}
          .store=${this.store}
          .pending=${this.pending}
          @tobor-transcript-clear=${this.#onClear}
        ></tobor-transcript-view>
        ${this.showComposer
          ? html`
              <form @submit=${this.#onSubmit}>
                <textarea
                  data-cy="thread.composer"
                  part="composer"
                  rows="2"
                  aria-label="Message"
                  .value=${this._draft}
                  @input=${this.#onDraft}
                  @keydown=${this.#onComposerKey}
                ></textarea>
                <button data-cy="thread.send" part="send" type="submit">Send</button>
              </form>
            `
          : nothing}
      </div>
    `;
  }

  #viewTurns(): Turn[] {
    if (this.messages.length) return messagesToTurns(this.messages, this.participants);
    return this.turns;
  }

  #onDraft(event: InputEvent): void {
    this._draft = (event.target as HTMLTextAreaElement).value;
  }

  #onComposerKey(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    this.#sendFrom((event.target as HTMLTextAreaElement).value);
  }

  #onSubmit(event: Event): void {
    event.preventDefault();
    const field = this.renderRoot.querySelector('[data-cy="thread.composer"]') as HTMLTextAreaElement | null;
    this.#sendFrom(field?.value ?? this._draft);
  }

  #sendFrom(raw: string): void {
    const text = raw.trim();
    if (!text) return;
    emit<ThreadSendDetail>(this, "thread-send", { text });
    this._draft = "";
  }

  #onClear(): void {
    this.turns = [];
    this.messages = [];
    this.load = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-chat-thread": ToborChatThread;
  }
}

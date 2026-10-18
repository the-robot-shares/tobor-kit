/**
 * `<tobor-mode-toggle>` — voice ⇄ text ⇄ transcript switcher.
 *
 * The mode list and the default come from the guide projection's `modes` and
 * `default_mode` (display order is the array order). Properties down, one
 * event up: `tobor-mode-change`.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {property} from "lit/decorators.js";

import { toborKitControls, toborKitTokens } from "../mode-toggle/theme.js";
import { emit } from "../../events.js";
import type { GuideMode } from "../../types.js";
import {defineElement} from '../../define.js';

export const MODE_LABELS: Record<GuideMode, string> = {
  voice: "Voice",
  text: "Text",
  transcript: "Transcript",
};

@defineElement("tobor-mode-toggle")
export class ToborModeToggle extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: inline-block;
      }

      [role="radiogroup"] {
        display: inline-flex;
        gap: 4px;
        padding: 3px;
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
      }

      button {
        border: none;
        border-radius: calc(var(--_radius) / 2 - 1px);
        padding: 5px 12px;
      }

      button[aria-checked="true"] {
        cursor: default;
      }
    `,
  ];

  /** Available modes, display order. From `modes` on the projection. */
  @property({ attribute: false })
  modes: GuideMode[] = ["text"];

  /** The active mode. From `default_mode` initially, then user selection. */
  @property({ type: String })
  mode: GuideMode = "text";

  @property({ type: Boolean })
  disabled = false;

  override render(): TemplateResult | typeof nothing {
    if (!this.modes.length) return nothing;
    return html`
      <div role="radiogroup" aria-label="Conversation mode" part="group">
        ${this.modes.map(
          (m) => html`
            <button
              role="radio"
              part="mode"
              data-mode=${m}
              aria-checked=${m === this.mode ? "true" : "false"}
              ?disabled=${this.disabled || m === this.mode}
              @click=${() => this.#select(m)}
            >
              ${MODE_LABELS[m] ?? m}
            </button>
          `,
        )}
      </div>
    `;
  }

  #select(mode: GuideMode): void {
    if (this.disabled || mode === this.mode) return;
    const previous = this.mode;
    this.mode = mode;
    emit(this, "tobor-mode-change", { mode, previous });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-mode-toggle": ToborModeToggle;
  }
}

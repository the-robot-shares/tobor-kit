/**
 * `<tobor-telemetry-toggle>` — the user's consent control for content capture.
 *
 * Contract behavior this element encodes:
 *
 * - Consent is resolved server-side (`GET /telemetry/consent`); the element
 *   renders what the server says, never a local default.
 * - `source: "forced"` (or `user_overridable: false`) means the guide default
 *   is binding — the element renders NOTHING. A toggle that cannot change
 *   anything is a lie in the UI.
 * - `PUT /telemetry/consent` answering 403 means the server disagreed with the
 *   client's belief that the toggle was overridable; the element reverts to
 *   inert and shows why, rather than leaving a dead control.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {property, state} from "lit/decorators.js";

import { toborKitControls, toborKitTokens } from "../mode-toggle/theme.js";
import { emit } from "../../events.js";
import type { ToborKitClient } from "../../client.js";
import type { TelemetryConsent } from "../../types.js";
import {defineElement} from '../../define.js';

@defineElement("tobor-telemetry-toggle")
export class ToborTelemetryToggle extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85em;
        color: var(--_muted);
        cursor: pointer;
      }

      input[type="checkbox"] {
        accent-color: var(--_accent);
        width: 15px;
        height: 15px;
        margin: 0;
      }
    `,
  ];

  /** Client used to read and write consent. Omit to drive via `consent`. */
  @property({ attribute: false })
  client?: ToborKitClient;

  /**
   * Consent state. Provide directly to render without any API access; when
   * omitted and a `client` is present, the element fetches it on connect.
   */
  @property({ attribute: false })
  consent?: TelemetryConsent;

  @state()
  private _error = "";

  @state()
  private _saving = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.consent && this.client) void this.#load();
  }

  /** True when the user may actually change the resolved value. */
  get overridable(): boolean {
    const c = this.consent;
    return !!c && c.source !== "forced" && c.user_overridable !== false;
  }

  override render(): TemplateResult | typeof nothing {
    const c = this.consent;
    if (c) {
      // Forced consent: render nothing at all — not a disabled toggle.
      if (!this.overridable) return nothing;
      return html`
        <label part="label">
          <input
            type="checkbox"
            part="checkbox"
            data-testid="telemetry-toggle"
            .checked=${c.enabled}
            ?disabled=${this._saving}
            aria-label="Allow the guide to log conversation content"
            @change=${(e: Event) => this.#toggle((e.target as HTMLInputElement).checked)}
          />
          <span>Log conversation content for debugging</span>
        </label>
      `;
    }
    if (this._error) {
      return html`<div class="notice notice--error" data-testid="telemetry-error">
        Could not load telemetry consent: ${this._error}
      </div>`;
    }
    // Still loading, or no client and no consent provided.
    return nothing;
  }

  async #load(): Promise<void> {
    if (!this.client) return;
    try {
      this.consent = await this.client.getTelemetryConsent();
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
    }
  }

  async #toggle(enabled: boolean): Promise<void> {
    const previous = this.consent;
    this._saving = true;
    try {
      const result = await this.client?.setTelemetryConsent(enabled);
      if (result?.ok) {
        this.consent = result.consent;
        emit(this, "tobor-telemetry-change", { consent: result.consent });
      } else if (result && !result.ok) {
        // 403 — the server says the default is binding. Stop offering the lie.
        this.consent = previous
          ? { ...previous, source: "forced", user_overridable: false }
          : { enabled: !enabled, source: "forced", user_overridable: false };
        emit(this, "tobor-telemetry-change", { consent: this.consent });
      }
    } finally {
      this._saving = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-telemetry-toggle": ToborTelemetryToggle;
  }
}

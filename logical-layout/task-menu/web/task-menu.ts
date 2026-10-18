/**
 * `<tobor-task-menu>` — the task/context menu, derived from the same
 * server-dressed `GET /mcp/tools` response as the tool list.
 *
 * The overlay (labels, grouping, order, hidden, confirm) was applied
 * server-side precisely so this element and its Swift twin cannot drift; the
 * menu never re-dresses anything client-side. `confirm: true` tools get a
 * two-step inline confirmation before `tobor-task-select` fires.
 *
 * Selecting a tool does NOT invoke it — it names an MCP tool the guide should
 * prefer for the next turn (`task_id` advisory on POST /turn). The host app
 * (or `<tobor-guide-panel>`) decides what to do with the selection.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {property, state} from "lit/decorators.js";

import { toborKitControls, toborKitTokens } from "../mode-toggle/theme.js";
import { emit } from "../../events.js";
import type { Tool, ToolInventory } from "../../types.js";
import {defineElement} from '../../define.js';

@defineElement("tobor-task-menu")
export class ToborTaskMenu extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: inline-block;
        position: relative;
      }

      .panel {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 0;
        min-width: 260px;
        max-width: 340px;
        max-height: 380px;
        overflow-y: auto;
        background: var(--_bg);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        box-shadow: var(--_shadow);
        padding: 10px;
        z-index: 10;
      }

      .confirm-row {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }

      .confirm-row button {
        font-size: 0.8em;
      }

      .confirm-text {
        font-size: 0.85em;
        padding: 6px 4px;
      }
    `,
  ];

  /** Server-dressed inventory — shared with the tool list, fetched once. */
  @property({ attribute: false })
  inventory?: ToolInventory | null;

  @property({ type: Boolean, reflect: true })
  open = false;

  @state()
  private _confirming: Tool | null = null;

  override render(): TemplateResult {
    return html`
      <button
        part="trigger"
        data-testid="task-menu-trigger"
        aria-haspopup="menu"
        aria-expanded=${this.open ? "true" : "false"}
        @click=${() => this.#setOpen(!this.open)}
      >
        Tasks ▴
      </button>
      ${this.open ? this.#panel() : nothing}
    `;
  }

  #panel(): TemplateResult {
    const inv = this.inventory;
    const degraded = inv?.degraded ?? [];
    return html`
      <div class="panel" role="menu" data-testid="task-menu-panel" @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Escape") this.#setOpen(false);
      }}>
        ${degraded.length
          ? html`
              <div class="notice" data-testid="task-menu-degraded" part="degraded">
                ${degraded.map((d) =>
                  d.server
                    ? html`<div>${d.server} unreachable</div>`
                    : html`<div data-testid="task-menu-degraded-unidentified">
                        A tool server is unreachable
                      </div>`,
                )}
              </div>
            `
          : nothing}
        ${this._confirming
          ? html`
              <div class="confirm-text" data-testid="task-confirm-text">
                Run “${this._confirming.label}”? This action is not read-only.
              </div>
              <div class="confirm-row">
                <button
                  data-testid="task-confirm-yes"
                  @click=${() => this.#select(this._confirming!)}
                >
                  Run it
                </button>
                <button @click=${() => (this._confirming = null)}>Cancel</button>
              </div>
            `
          : nothing}
        ${(inv?.tools ?? [])
          .filter((t) => t !== this._confirming)
          .map(
            (tool) => html`
              <button
                role="menuitem"
                part="item"
                data-tool=${tool.name}
                @click=${() => this.#toolClicked(tool)}
              >
                ${tool.label}${tool.confirm ? " ⚠" : ""}
              </button>
            `,
          )}
        ${!inv || !inv.tools.length
          ? html`<div class="muted" data-testid="task-menu-empty">No tasks available.</div>`
          : nothing}
      </div>
    `;
  }

  #setOpen(open: boolean): void {
    this.open = open;
    if (!open) this._confirming = null;
  }

  #toolClicked(tool: Tool): void {
    if (tool.confirm) {
      this._confirming = tool;
      return;
    }
    this.#select(tool);
  }

  #select(tool: Tool): void {
    emit(this, "tobor-task-select", { tool });
    this.#setOpen(false);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-task-menu": ToborTaskMenu;
  }
}

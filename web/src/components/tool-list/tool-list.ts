/**
 * `<tobor-tool-list>` — browsable view over `GET /mcp/tools`.
 *
 * The server has already applied the guide's allow/deny globs and the
 * `mcp.menu` overlay; this element renders the response VERBATIM. In
 * particular `degraded[]` is surfaced prominently — a short tool list because
 * a server is down is information, not a rendering accident to hide.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {property} from "lit/decorators.js";

import { toborKitControls, toborKitTokens } from "../mode-toggle/theme.js";
import { emit } from "../../events.js";
import type { Tool, ToolInventory } from "../../types.js";
import {defineElement} from '../../define.js';

@defineElement("tobor-tool-list")
export class ToborToolList extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .group {
        margin-bottom: 12px;
      }

      .group-label {
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--_muted);
        margin: 0 0 6px;
      }

      .tool {
        display: flex;
        align-items: baseline;
        gap: 8px;
        width: 100%;
        text-align: left;
        padding: 7px 10px;
        margin-bottom: 4px;
      }

      .tool .name {
        font-size: 0.85em;
        color: var(--_muted);
      }

      .tool .desc {
        flex-basis: 100%;
        font-size: 0.85em;
        color: var(--_muted);
      }

      .badge {
        font-size: 0.7em;
        border: 1px solid var(--_border);
        border-radius: 999px;
        padding: 1px 7px;
        color: var(--_muted);
        white-space: nowrap;
      }

      .badge--confirm {
        border-color: var(--_warn);
        color: var(--_warn);
      }

      .degraded {
        margin-bottom: 12px;
      }

      .degraded ul {
        margin: 6px 0 0;
        padding-left: 18px;
      }

      .none {
        color: var(--_muted);
        font-size: 0.9em;
        padding: 8px 4px;
      }
    `,
  ];

  /** The server-dressed inventory. Null/undefined renders the empty state. */
  @property({ attribute: false })
  inventory?: ToolInventory | null;

  @property({ type: Boolean, attribute: "show-descriptions" })
  showDescriptions = true;

  override render(): TemplateResult {
    const inv = this.inventory;
    if (!inv) {
      return html`<div class="none" data-testid="tools-unavailable">Tools unavailable.</div>`;
    }

    const degraded = inv.degraded ?? [];
    const grouped = new Map<string, Tool[]>();
    for (const tool of inv.tools) {
      const list = grouped.get(tool.group) ?? [];
      list.push(tool);
      grouped.set(tool.group, list);
    }
    const labelFor = new Map(inv.groups.map((g) => [g.id, g.label]));

    return html`
      ${degraded.length
        ? html`
            <div class="notice degraded" data-testid="degraded-servers" part="degraded">
              <strong>Some tool servers are unreachable:</strong>
              <ul>
                ${degraded.map((d) =>
                  d.server
                    ? html`<li data-server=${d.server}>${d.server}${d.error ? ` — ${d.error}` : ""}</li>`
                    : // Degraded entry with no identity: say so generically.
                      html`<li data-testid="degraded-unidentified">A tool server is unreachable</li>`,
                )}
              </ul>
            </div>
          `
        : nothing}
      ${grouped.size
        ? [...grouped.entries()].map(([groupId, tools]) =>
            html`
              <section class="group" data-group=${groupId} part="group">
                <p class="group-label">${labelFor.get(groupId) ?? groupId}</p>
                ${tools.map((tool) => this.#tool(tool))}
              </section>
            `,
          )
        : html`<div class="none" data-testid="tools-empty">No tools are exposed for this guide.</div>`}
    `;
  }

  #tool(tool: Tool): TemplateResult {
    return html`
      <button
        class="tool"
        part="tool"
        data-tool=${tool.name}
        @click=${() => emit(this, "tobor-tool-select", { tool })}
      >
        <span>${tool.label}</span>
        ${tool.read_only ? html`<span class="badge">read-only</span>` : nothing}
        ${tool.confirm ? html`<span class="badge badge--confirm">confirm</span>` : nothing}
        <span class="name">${tool.name}</span>
        ${this.showDescriptions && tool.description
          ? html`<span class="desc">${tool.description}</span>`
          : nothing}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-tool-list": ToborToolList;
  }
}

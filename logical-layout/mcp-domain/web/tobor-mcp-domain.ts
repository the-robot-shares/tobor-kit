/**
 * `<tobor-mcp-domain>` — tri-state visibility per MCP tool.
 *
 * Properties down, events up. Host persists `tool-visibility-change`.
 * Composes `<tobor-tool-list>` as a preview of currently `visible` tools.
 */

import {LitElement, css, html, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';

import {emit} from '../../events.js';
import type {ToolInventory} from '../../types.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import '../tool-list/tool-list.js';
import {
  TOOL_VISIBILITIES,
  labelFor,
  normalizeDomainTools,
  normalizeVisibility,
  visibleInventory,
  type McpDomainTool,
  type ToolVisibility,
  type ToolVisibilityChangeDetail,
} from './types.js';
import {defineElement} from '../../define.js';

export type {McpDomainTool, ToolVisibility, ToolVisibilityChangeDetail} from './types.js';
export {
  SAMPLE_INVENTORY,
  SAMPLE_TOOLS,
  TOOL_VISIBILITIES,
  isToolVisibility,
  labelFor,
  normalizeDomainTools,
  normalizeVisibility,
  visibleInventory,
} from './types.js';

@defineElement('tobor-mcp-domain')
export class ToborMcpDomain extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .stack {
        display: grid;
        gap: var(--_gap);
      }

      .tools {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
      }

      .tool {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
      }

      .name {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.9em;
      }

      .label {
        font-size: 0.85em;
      }

      select {
        font: inherit;
        color: inherit;
        background: var(--_bg);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 10px;
      }

      .preview-label {
        margin: 0;
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--_muted);
      }
    `,
  ];

  /** Per-tool visibility policy. Property-only — not an HTML attribute. */
  @property({attribute: false})
  tools: McpDomainTool[] = [];

  /**
   * Optional dressed inventory. Property-only. Labels the admin rows and is
   * filtered into the composed `<tobor-tool-list>` preview.
   */
  @property({attribute: false})
  inventory?: ToolInventory | null;

  override render(): TemplateResult {
    const rows = normalizeDomainTools(this.tools);
    return html`
      <div class="stack" data-cy="mcp.domain" part="root">
        ${rows.length
          ? html`
              <ul class="tools" part="tools">
                ${rows.map((row) => this.#row(row))}
              </ul>
            `
          : html`<p class="muted">No tools.</p>`}
        <p class="preview-label">Visible tools</p>
        <tobor-tool-list
          part="preview"
          .inventory=${visibleInventory(rows, this.inventory)}
          @tobor-tool-select=${this.#onPreviewSelect}
        ></tobor-tool-list>
      </div>
    `;
  }

  #row(row: McpDomainTool): TemplateResult {
    const label = labelFor(row.name, this.inventory);
    const selectId = `vis-${row.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    return html`
      <li
        class="tool"
        part="tool"
        data-cy="mcp.tool"
        data-tool=${row.name}
        data-visibility=${row.visibility}
      >
        <span>
          ${label !== row.name ? html`<span class="label">${label}</span> ` : ''}
          <span class="name">${row.name}</span>
        </span>
        <label>
          <span class="muted">Visibility</span>
          <select
            id=${selectId}
            part="visibility"
            aria-label=${`Visibility for ${row.name}`}
            @change=${(event: Event) => this.#onVisibility(event, row.name)}
          >
            ${TOOL_VISIBILITIES.map(
              (value) =>
                html`<option value=${value} ?selected=${value === row.visibility}>${caption(value)}</option>`,
            )}
          </select>
        </label>
      </li>
    `;
  }

  #onVisibility(event: Event, name: string): void {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    const visibility = normalizeVisibility(select.value);
    this.tools = normalizeDomainTools(this.tools).map((row) =>
      row.name === name ? {...row, visibility} : row,
    );
    emit<ToolVisibilityChangeDetail>(this, 'tool-visibility-change', {name, visibility});
  }

  #onPreviewSelect(event: Event): void {
    event.stopPropagation();
  }
}

function caption(value: ToolVisibility): string {
  switch (value) {
    case 'visible':
      return 'Visible';
    case 'discoverable':
      return 'Discoverable';
    case 'disabled':
      return 'Disabled';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-mcp-domain': ToborMcpDomain;
  }
}

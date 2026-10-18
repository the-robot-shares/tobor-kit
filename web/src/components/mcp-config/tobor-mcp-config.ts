/**
 * `<tobor-mcp-config>` — MCP transport / server params form.
 *
 * Emits `config-change` on save. The host validates and persists.
 * This island carries no secrets and does not connect to MCP servers.
 */

import {LitElement, css, html, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export const MCP_TRANSPORTS = ['stdio', 'http', 'sse'] as const;

export type McpTransport = (typeof MCP_TRANSPORTS)[number];

export type McpConfigExtras = Record<string, unknown>;

export interface McpConfigChangeDetail {
  url: string;
  transport: McpTransport;
  extras?: McpConfigExtras;
}

export function isMcpTransport(value: unknown): value is McpTransport {
  return typeof value === 'string' && (MCP_TRANSPORTS as readonly string[]).includes(value);
}

export function normalizeTransport(value: unknown): McpTransport {
  return isMcpTransport(value) ? value : 'http';
}

/** Drop empty extras so the event stays `{url, transport}` when unused. */
export function extrasForEvent(extras: McpConfigExtras | null | undefined): McpConfigExtras | undefined {
  if (!extras || typeof extras !== 'object' || Array.isArray(extras)) return undefined;
  return Object.keys(extras).length ? extras : undefined;
}

@defineElement('tobor-mcp-config')
export class ToborMcpConfig extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      form {
        display: grid;
        gap: var(--_gap);
      }

      .field {
        display: grid;
        gap: 4px;
      }

      .field span {
        font-size: 0.85em;
        color: var(--_muted);
      }

      input,
      select {
        font: inherit;
        color: inherit;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 10px;
      }

      button[part='save'] {
        justify-self: start;
      }
    `,
  ];

  /** Server URL (http/sse) or command path (stdio). Host validates. */
  @property({type: String, reflect: true})
  url = '';

  /** `stdio` | `http` | `sse`. */
  @property({type: String, reflect: true})
  transport: McpTransport = 'http';

  /**
   * Optional non-secret extras (`timeoutMs`, `args`, …). Property-only.
   * Never put tokens, env, or Authorization headers here.
   */
  @property({attribute: false})
  extras: McpConfigExtras | null = null;

  override render(): TemplateResult {
    const transport = normalizeTransport(this.transport);
    return html`
      <form data-cy="mcp.config" part="root" @submit=${this.#onSubmit}>
        <label class="field" for="mcp-url">
          <span>URL / command</span>
          <input
            id="mcp-url"
            name="url"
            type="text"
            part="url"
            autocomplete="off"
            spellcheck="false"
            placeholder=${transport === 'stdio' ? '/usr/local/bin/mcp-server' : 'https://mcp.example.test/mcp'}
            aria-label="MCP URL or command"
            .value=${live(this.url)}
            @input=${this.#onUrl}
          />
        </label>
        <label class="field" for="mcp-transport">
          <span>Transport</span>
          <select
            id="mcp-transport"
            name="transport"
            part="transport"
            aria-label="MCP transport"
            @change=${this.#onTransport}
          >
            ${MCP_TRANSPORTS.map(
              (value) =>
                html`<option value=${value} ?selected=${value === transport}>${value}</option>`,
            )}
          </select>
        </label>
        <button part="save" type="submit" data-cy="mcp.save">Save</button>
      </form>
    `;
  }

  #onUrl(event: Event): void {
    const input = event.currentTarget;
    if (input instanceof HTMLInputElement) this.url = input.value;
  }

  #onTransport(event: Event): void {
    const select = event.currentTarget;
    if (select instanceof HTMLSelectElement) this.transport = normalizeTransport(select.value);
  }

  #onSubmit(event: Event): void {
    event.preventDefault();
    this.transport = normalizeTransport(this.transport);
    const detail: McpConfigChangeDetail = {
      url: this.url.trim(),
      transport: this.transport,
    };
    const extras = extrasForEvent(this.extras);
    if (extras) detail.extras = extras;
    emit<McpConfigChangeDetail>(this, 'config-change', detail);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-mcp-config': ToborMcpConfig;
  }
}

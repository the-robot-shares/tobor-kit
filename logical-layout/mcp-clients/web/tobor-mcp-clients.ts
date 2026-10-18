/**
 * `<tobor-mcp-clients>` — MCP client roster (OAuth / API key).
 *
 * Emits `client-authorize` / `client-revoke`. OAuth redirect is host-owned;
 * this island never assigns `location` and never stores secrets.
 */

import {LitElement, css, html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export const MCP_CLIENT_AUTHS = ['oauth', 'api-key'] as const;

export type McpClientAuth = (typeof MCP_CLIENT_AUTHS)[number];

export interface McpClient {
  id: string;
  name: string;
  status: string;
  auth: McpClientAuth;
}

export interface ClientAuthorizeDetail {
  id: string;
}

export interface ClientRevokeDetail {
  id: string;
}

export const SAMPLE_CLIENTS: McpClient[] = [
  {id: 'github', name: 'GitHub', status: 'disconnected', auth: 'oauth'},
  {id: 'search', name: 'Search', status: 'connected', auth: 'api-key'},
];

export function isMcpClientAuth(value: unknown): value is McpClientAuth {
  return typeof value === 'string' && (MCP_CLIENT_AUTHS as readonly string[]).includes(value);
}

export function normalizeClients(clients: unknown): McpClient[] {
  if (!Array.isArray(clients)) return [];
  const rows: McpClient[] = [];
  for (const row of clients) {
    if (!row || typeof row !== 'object') continue;
    const id = String((row as McpClient).id ?? '').trim();
    if (!id) continue;
    const name = String((row as McpClient).name ?? '').trim() || id;
    const status = String((row as McpClient).status ?? '').trim() || 'disconnected';
    const auth = isMcpClientAuth((row as McpClient).auth) ? (row as McpClient).auth : 'oauth';
    rows.push({id, name, status, auth});
  }
  return rows;
}

@defineElement('tobor-mcp-clients')
export class ToborMcpClients extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
      }

      .client {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
      }

      .name {
        font-weight: 650;
      }

      .meta {
        font-size: 0.85em;
        color: var(--_muted);
        margin-right: auto;
      }

      .status[data-kind='connected'],
      .status[data-kind='authorized'] {
        color: var(--_accent);
      }

      .status[data-kind='error'],
      .status[data-kind='failed'] {
        color: var(--_danger);
      }

      .status[data-kind='pending'],
      .status[data-kind='authorizing'] {
        color: var(--_warn);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
    `,
  ];

  /** Client roster. Property-only — not an HTML attribute. */
  @property({attribute: false})
  clients: McpClient[] = [];

  override render(): TemplateResult {
    const rows = normalizeClients(this.clients);
    return html`
      <div data-cy="mcp.clients" part="root">
        ${rows.length
          ? html`
              <ul>
                ${rows.map((row) => this.#row(row))}
              </ul>
            `
          : html`<p class="muted">No clients.</p>`}
      </div>
    `;
  }

  #row(row: McpClient): TemplateResult {
    const kind = row.status.trim().toLowerCase().replace(/\s+/g, '_');
    return html`
      <li class="client" part="client" data-client-id=${row.id} data-auth=${row.auth}>
        <span class="name">${row.name}</span>
        <span class="meta">
          <span class="status" part="status" data-kind=${kind || nothing}>${row.status}</span>
          · ${row.auth === 'api-key' ? 'API key' : 'OAuth'}
        </span>
        <span class="actions">
          <button
            type="button"
            part="authorize"
            data-cy="mcp.authorize"
            data-client-id=${row.id}
            @click=${() => this.#authorize(row.id)}
          >
            Authorize
          </button>
          <button
            type="button"
            part="revoke"
            data-cy="mcp.revoke"
            data-client-id=${row.id}
            @click=${() => this.#revoke(row.id)}
          >
            Revoke
          </button>
        </span>
      </li>
    `;
  }

  #authorize(id: string): void {
    if (!id) return;
    emit<ClientAuthorizeDetail>(this, 'client-authorize', {id});
  }

  #revoke(id: string): void {
    if (!id) return;
    emit<ClientRevokeDetail>(this, 'client-revoke', {id});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-mcp-clients': ToborMcpClients;
  }
}

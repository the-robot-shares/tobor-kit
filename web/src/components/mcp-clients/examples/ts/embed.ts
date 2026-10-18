/**
 * Typed mount for tobor-mcp-clients.
 * Host: import '@noizu/tobor-kit/mcp-clients.js';
 */
import '../../tobor-mcp-clients.js';
import type {
  ClientAuthorizeDetail,
  ClientRevokeDetail,
  McpClient,
} from '../../tobor-mcp-clients.js';

export interface MountMcpClientsOptions {
  clients?: McpClient[];
  onAuthorize?: (detail: ClientAuthorizeDetail) => void;
  onRevoke?: (detail: ClientRevokeDetail) => void;
}

/**
 * Mount <tobor-mcp-clients>. Host-owned: OAuth redirect (never the island)
 * and persist via GET/POST /mcp/clients… (example, not a kit dependency).
 */
export function mountMcpClients(
  host: HTMLElement,
  options: MountMcpClientsOptions = {},
): HTMLElementTagNameMap['tobor-mcp-clients'] {
  const el = document.createElement('tobor-mcp-clients');
  el.clients = options.clients ?? [
    {id: 'github', name: 'GitHub', status: 'disconnected', auth: 'oauth'},
    {id: 'search', name: 'Search', status: 'connected', auth: 'api-key'},
  ];
  el.addEventListener('client-authorize', (event) => {
    options.onAuthorize?.((event as CustomEvent<ClientAuthorizeDetail>).detail);
  });
  el.addEventListener('client-revoke', (event) => {
    options.onRevoke?.((event as CustomEvent<ClientRevokeDetail>).detail);
  });
  host.append(el);
  return el;
}

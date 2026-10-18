/**
 * Vanilla mount for tobor-mcp-clients.
 * Host: import '@noizu/tobor-kit/mcp-clients.js';
 */
import '../../tobor-mcp-clients.js';

/**
 * Mount <tobor-mcp-clients>. Host-owned: OAuth redirect and key vault.
 * The island never assigns location.
 */
export function mountMcpClients(host, options = {}) {
  const el = document.createElement('tobor-mcp-clients');
  el.clients = options.clients ?? [
    {id: 'github', name: 'GitHub', status: 'disconnected', auth: 'oauth'},
    {id: 'search', name: 'Search', status: 'connected', auth: 'api-key'},
  ];
  el.addEventListener('client-authorize', (event) => {
    options.onAuthorize?.(event.detail);
  });
  el.addEventListener('client-revoke', (event) => {
    options.onRevoke?.(event.detail);
  });
  host.append(el);
  return el;
}

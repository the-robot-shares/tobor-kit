/**
 * Vanilla mount for tobor-mcp-config.
 * Host: import '@noizu/tobor-kit/mcp-config.js';
 */
import '../../tobor-mcp-config.js';

/**
 * Mount <tobor-mcp-config>. Host-owned: validate & persist config-change.
 * Never put tokens in extras.
 */
export function mountMcpConfig(host, options = {}) {
  const el = document.createElement('tobor-mcp-config');
  el.url = options.url ?? 'https://mcp.example.test/mcp';
  el.transport = options.transport ?? 'http';
  if (options.extras) el.extras = options.extras;
  el.addEventListener('config-change', (event) => {
    options.onConfigChange?.(event.detail);
  });
  host.append(el);
  return el;
}

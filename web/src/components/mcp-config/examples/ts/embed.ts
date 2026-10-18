/**
 * Typed mount for tobor-mcp-config.
 * Host: import '@noizu/tobor-kit/mcp-config.js';
 */
import '../../tobor-mcp-config.js';
import type {
  McpConfigChangeDetail,
  McpConfigExtras,
  McpTransport,
} from '../../tobor-mcp-config.js';

export interface MountMcpConfigOptions {
  url?: string;
  transport?: McpTransport;
  extras?: McpConfigExtras;
  onConfigChange?: (detail: McpConfigChangeDetail) => void;
}

/**
 * Mount <tobor-mcp-config>. Host-owned: persist via GET/PUT /mcp/config
 * (example, not a kit dependency). Never put tokens in extras.
 */
export function mountMcpConfig(
  host: HTMLElement,
  options: MountMcpConfigOptions = {},
): HTMLElementTagNameMap['tobor-mcp-config'] {
  const el = document.createElement('tobor-mcp-config');
  el.url = options.url ?? 'https://mcp.example.test/mcp';
  el.transport = options.transport ?? 'http';
  if (options.extras) el.extras = options.extras;
  el.addEventListener('config-change', (event) => {
    options.onConfigChange?.((event as CustomEvent<McpConfigChangeDetail>).detail);
  });
  host.append(el);
  return el;
}

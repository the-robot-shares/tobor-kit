/**
 * Vanilla mount for tobor-mcp-domain.
 * Host: import '@noizu/tobor-kit/mcp-domain.js';
 */
import '../../tobor-mcp-domain.js';

/**
 * Mount <tobor-mcp-domain>. Host-owned: persist tool-visibility-change.
 */
export function mountMcpDomain(host, options = {}) {
  const el = document.createElement('tobor-mcp-domain');
  el.tools = options.tools ?? [
    {name: 'Github.PullCreate', visibility: 'visible'},
    {name: 'Github.IssueList', visibility: 'discoverable'},
    {name: 'Filesystem.Write', visibility: 'disabled'},
  ];
  if (options.inventory) el.inventory = options.inventory;
  el.addEventListener('tool-visibility-change', (event) => {
    options.onVisibilityChange?.(event.detail);
  });
  host.append(el);
  return el;
}

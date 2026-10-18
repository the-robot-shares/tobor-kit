/**
 * Typed mount for tobor-mcp-domain.
 * Host: import '@noizu/tobor-kit/mcp-domain.js';
 */
import '../../tobor-mcp-domain.js';
import type {ToolInventory} from '../../../../types.js';
import type {McpDomainTool, ToolVisibilityChangeDetail} from '../../types.js';

export interface MountMcpDomainOptions {
  tools?: McpDomainTool[];
  inventory?: ToolInventory;
  onVisibilityChange?: (detail: ToolVisibilityChangeDetail) => void;
}

/**
 * Mount <tobor-mcp-domain>. Host-owned: persist via GET/PATCH /mcp/domain
 * (example, not a kit dependency).
 */
export function mountMcpDomain(
  host: HTMLElement,
  options: MountMcpDomainOptions = {},
): HTMLElementTagNameMap['tobor-mcp-domain'] {
  const el = document.createElement('tobor-mcp-domain');
  el.tools = options.tools ?? [
    {name: 'Github.PullCreate', visibility: 'visible'},
    {name: 'Github.IssueList', visibility: 'discoverable'},
    {name: 'Filesystem.Write', visibility: 'disabled'},
  ];
  if (options.inventory) el.inventory = options.inventory;
  el.addEventListener('tool-visibility-change', (event) => {
    options.onVisibilityChange?.((event as CustomEvent<ToolVisibilityChangeDetail>).detail);
  });
  host.append(el);
  return el;
}

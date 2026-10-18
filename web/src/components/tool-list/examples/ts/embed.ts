// Host copy-paste: `import '@noizu/tobor-kit/tool-list.js'` and types from `@noizu/tobor-kit`.
import '../../tool-list.js';
import type {ToborToolList} from '../../tool-list.js';
import type {Tool, ToolInventory} from '../../../../types.js';

const TOOLS_PATH = '/api/tobor-kit/mcp/tools';

export interface MountToolListOptions {
  /** Host-resolved headers (e.g. Authorization). Never hard-code secrets. */
  headers?: HeadersInit;
}

/**
 * Mount `<tobor-tool-list>` and assign `.inventory` from GET /mcp/tools.
 * Selecting a tool is advisory: the host may send `tool.name` as `task_id`
 * on POST /sessions/{id}/turn. The guide may decline.
 */
export async function mountToolList(
  target: ParentNode,
  options: MountToolListOptions = {},
): Promise<ToborToolList> {
  const el = document.createElement('tobor-tool-list') as ToborToolList;
  el.showDescriptions = true;
  target.append(el);

  const res = await fetch(TOOLS_PATH, {headers: options.headers});
  if (!res.ok) {
    throw new Error(`GET ${TOOLS_PATH} failed: ${res.status}`);
  }
  const inventory = (await res.json()) as ToolInventory;
  el.inventory = inventory;

  el.addEventListener('tobor-tool-select', (event: Event) => {
    const tool = (event as CustomEvent<{tool: Tool}>).detail?.tool;
    console.info('tobor-tool-select', tool?.name);
  });

  return el;
}

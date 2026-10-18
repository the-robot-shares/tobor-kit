// Host apps: import from '@noizu/tobor-kit' (+ '@noizu/tobor-kit/task-menu.js').
import {ToborTaskMenu} from '../../task-menu.js';
import {ToborKitClient} from '../../../../client.js';
import type {Tool} from '../../../../types.js';

/**
 * Typed mount. `listTools()` is GET /mcp/tools and already fills degraded[].
 * Host-owned: token provider, redirects, turn submission (`task_id`).
 */
export async function mountTaskMenu(root: ParentNode = document.body): Promise<ToborTaskMenu> {
  const el = document.createElement('tobor-task-menu') as ToborTaskMenu;
  root.append(el);

  const client = new ToborKitClient({
    baseUrl: '/api/tobor-kit',
    token: () => sessionStorage.getItem('tobor-access-token'),
  });

  try {
    el.inventory = await client.listTools();
  } catch {
    // 401 / 502 required-down / network: island stays on "No tasks available."
  }

  el.addEventListener('tobor-task-select', (event: Event) => {
    const tool = (event as CustomEvent<{tool: Tool}>).detail.tool;
    console.log('tobor-task-select', tool.name, tool);
  });

  return el;
}

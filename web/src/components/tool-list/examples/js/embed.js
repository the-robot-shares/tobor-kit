import '@noizu/tobor-kit/tool-list.js';

const TOOLS_PATH = '/api/tobor-kit/mcp/tools';

/**
 * Mount `<tobor-tool-list>` and assign server-dressed inventory (degraded[] included).
 * Host-owned: bearer token, persistence, POST /turn task_id.
 */
export async function mountToolList(target, {headers} = {}) {
  const el = document.createElement('tobor-tool-list');
  el.showDescriptions = true;
  target.append(el);

  // Never put secrets on the element. Pass Authorization from the host session if required.
  const res = await fetch(TOOLS_PATH, {headers});
  if (!res.ok) {
    throw new Error(`GET ${TOOLS_PATH} failed: ${res.status}`);
  }
  el.inventory = await res.json();

  el.addEventListener('tobor-tool-select', (event) => {
    // Advisory only — does not invoke or authorize the MCP tool.
    const tool = event.detail?.tool;
    console.info('tobor-tool-select', tool?.name);
  });

  return el;
}

import '@noizu/tobor-kit/task-menu.js';

/**
 * Vanilla mount. Host fetches GET /api/tobor-kit/mcp/tools and assigns the
 * property-only `inventory` (includes degraded[]). Do not re-dress tools.
 *
 * Host-owned: bearer token, persistence, what tobor-task-select should do.
 */
export async function mountTaskMenu(root = document.body) {
  const el = document.createElement('tobor-task-menu');
  root.append(el);

  const token = sessionStorage.getItem('tobor-access-token');
  const headers = token ? {Authorization: `Bearer ${token}`} : {};
  const res = await fetch('/api/tobor-kit/mcp/tools', {headers});
  if (res.ok) {
    el.inventory = await res.json();
  }

  el.addEventListener('tobor-task-select', (event) => {
    const tool = event.detail.tool;
    // Advisory: name a tool for the next turn. Do not invoke MCP here.
    console.log('tobor-task-select', tool.name, tool);
  });

  return el;
}

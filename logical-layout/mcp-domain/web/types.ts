import type {Tool, ToolInventory} from '../../types.js';

export const TOOL_VISIBILITIES = ['visible', 'discoverable', 'disabled'] as const;

export type ToolVisibility = (typeof TOOL_VISIBILITIES)[number];

export interface McpDomainTool {
  name: string;
  visibility: ToolVisibility;
}

export interface ToolVisibilityChangeDetail {
  name: string;
  visibility: ToolVisibility;
}

export const SAMPLE_TOOLS: McpDomainTool[] = [
  {name: 'Github.PullCreate', visibility: 'visible'},
  {name: 'Github.IssueList', visibility: 'discoverable'},
  {name: 'Filesystem.Write', visibility: 'disabled'},
];

export const SAMPLE_INVENTORY: ToolInventory = {
  groups: [
    {id: 'Github', label: 'Github'},
    {id: 'Filesystem', label: 'Filesystem'},
  ],
  tools: [
    {name: 'Github.PullCreate', label: 'Open a PR', group: 'Github', confirm: true},
    {name: 'Github.IssueList', label: 'List issues', group: 'Github', read_only: true},
    {name: 'Filesystem.Write', label: 'Write a file', group: 'Filesystem'},
  ],
};

export function isToolVisibility(value: unknown): value is ToolVisibility {
  return typeof value === 'string' && (TOOL_VISIBILITIES as readonly string[]).includes(value);
}

export function normalizeVisibility(value: unknown): ToolVisibility {
  return isToolVisibility(value) ? value : 'disabled';
}

export function normalizeDomainTools(tools: unknown): McpDomainTool[] {
  if (!Array.isArray(tools)) return [];
  const rows: McpDomainTool[] = [];
  for (const row of tools) {
    if (!row || typeof row !== 'object') continue;
    const name = String((row as McpDomainTool).name ?? '').trim();
    if (!name) continue;
    rows.push({name, visibility: normalizeVisibility((row as McpDomainTool).visibility)});
  }
  return rows;
}

/** Inventory of tools currently marked `visible` — fed to `<tobor-tool-list>`. */
export function visibleInventory(
  tools: McpDomainTool[],
  inventory?: ToolInventory | null,
): ToolInventory {
  const visible = new Set(
    normalizeDomainTools(tools)
      .filter((row) => row.visibility === 'visible')
      .map((row) => row.name),
  );
  if (inventory && Array.isArray(inventory.tools)) {
    const toolsOut = inventory.tools.filter((tool) => visible.has(tool.name));
    const groupIds = new Set(toolsOut.map((tool) => tool.group));
    const groups = Array.isArray(inventory.groups)
      ? inventory.groups.filter((group) => groupIds.has(group.id))
      : [];
    return {
      groups,
      tools: toolsOut,
      degraded: inventory.degraded ?? [],
    };
  }
  const synthetic: Tool[] = [...visible].map((name) => ({
    name,
    label: name,
    group: 'visible',
  }));
  return {
    groups: synthetic.length ? [{id: 'visible', label: 'Visible'}] : [],
    tools: synthetic,
  };
}

export function labelFor(name: string, inventory?: ToolInventory | null): string {
  const tool = inventory?.tools?.find((row) => row.name === name);
  const label = tool?.label?.trim();
  return label || name;
}

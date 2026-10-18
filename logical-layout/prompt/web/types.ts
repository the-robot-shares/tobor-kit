/** Shared shapes for the prompt family. Property-only — never HTML attributes. */

export interface PromptRecord {
  id: string;
  title: string;
  body: string;
  starred?: boolean;
}

export interface PromptHistoryEntry {
  id: string;
  title: string;
  at: string;
  version?: string | number;
  starred?: boolean;
}

export interface PromptDiffPane {
  label?: string;
  body: string;
}

export interface PromptDiff {
  left?: PromptDiffPane;
  right?: PromptDiffPane;
}

export interface PromptSelectDetail {
  id: string;
}

export interface PromptStarDetail {
  id: string;
  starred: boolean;
}

export interface PromptForkDetail {
  id: string;
}

/**
 * Prompt bodies are source text. Always characters — never parsed HTML.
 * Lit interpolation + `<pre>` keep markup visible as text.
 */
export function promptPlainText(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

export function formatPromptStamp(at: string | undefined): string {
  if (!at) return '';
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return at;
  return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function filterPrompts(prompts: PromptRecord[], query: string): PromptRecord[] {
  const rows = (Array.isArray(prompts) ? prompts : []).filter((row) => row?.id);
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const title = row.title ?? '';
    const body = row.body ?? '';
    return (
      row.id.toLowerCase().includes(q) ||
      title.toLowerCase().includes(q) ||
      body.toLowerCase().includes(q)
    );
  });
}

export const SAMPLE_PROMPTS: PromptRecord[] = [
  {
    id: 'sys',
    title: 'System',
    body: 'You are a helpful assistant.\nDo not render HTML.\n<section>stays source</section>',
    starred: true,
  },
  {
    id: 'brief',
    title: 'Brief',
    body: 'Be concise.\nNo HTML.',
  },
];

export const SAMPLE_HISTORY: PromptHistoryEntry[] = [
  {id: 'sys-v1', title: 'System', at: '2026-01-01T12:00:00Z', version: 1},
  {
    id: 'sys-v2',
    title: 'System',
    at: '2026-02-01T12:00:00Z',
    version: 2,
    starred: true,
  },
];

export const SAMPLE_DIFF: PromptDiff = {
  left: {label: 'v1', body: 'You are a helpful assistant.'},
  right: {label: 'v2', body: 'You are a concise assistant.\nNo HTML.\n<section>stays source</section>'},
};

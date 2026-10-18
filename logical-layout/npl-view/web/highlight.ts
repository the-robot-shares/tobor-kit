/**
 * NPL / prompt-lingua tokenizer + fold splitter.
 *
 * Highlighting is CSS classes on escaped text spans. The viewer must never
 * feed raw source to `unsafeHTML`.
 */

export const SAMPLE_SOURCE = `⌜NPL@1.0⌝

# Syntax
Greet {user.name} with [...:1sentence| warm].
Use 🎯 care.

# Agent
⌜guide|agent|NPL@1.0⌝
You are a helpful guide.
{{if user.admin}}
Admin tools are available.
{{/if}}
⌞guide⌟
`;

export type NplTokenKind =
  | 'text'
  | 'declaration'
  | 'placeholder'
  | 'infill'
  | 'highlight'
  | 'attention'
  | 'logic'
  | 'literal'
  | 'tag';

export interface NplToken {
  kind: NplTokenKind;
  text: string;
}

export interface NplSection {
  heading: string | null;
  body: string;
}

/** Foldable heading: a line whose trimmed start is `#` or `⌜NPL`. */
export function isNplFoldStart(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith('#') || t.startsWith('⌜NPL');
}

export function splitNplSections(source: string): NplSection[] {
  const lines = source.split('\n');
  const sections: NplSection[] = [];
  let heading: string | null = null;
  let body: string[] = [];

  const flush = (): void => {
    const text = body.join('\n');
    if (heading === null && text.trim() === '') {
      heading = null;
      body = [];
      return;
    }
    sections.push({heading, body: text});
    heading = null;
    body = [];
  };

  for (const line of lines) {
    if (isNplFoldStart(line)) {
      flush();
      heading = line;
      body = [];
    } else {
      body.push(line);
    }
  }
  flush();
  return sections;
}

const TOKEN_RE =
  /⌜[^⌜⌝\n]*⌝|⌞[^⌞⌟\n]*⌟|⟬[^⟬⟭]*⟭|\{\{\/?[^{}\n]*\}\}|<\/?npl-[a-zA-Z0-9-]+(?:\s[^>]*)?>|\{[^{}\n]+\}|\[[^\]]+\]|`[^`\n]+`|🎯/gu;

export function tokenizeNpl(source: string): NplToken[] {
  if (!source) return [];
  const tokens: NplToken[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      tokens.push({kind: 'text', text: source.slice(last, index)});
    }
    const text = match[0];
    tokens.push({kind: kindOf(text), text});
    last = index + text.length;
  }
  if (last < source.length) {
    tokens.push({kind: 'text', text: source.slice(last)});
  }
  return tokens;
}

function kindOf(raw: string): NplTokenKind {
  if (raw.startsWith('⌜') || raw.startsWith('⌞')) return 'declaration';
  if (raw.startsWith('⟬')) return 'literal';
  if (raw.startsWith('{{')) return 'logic';
  if (raw.startsWith('<')) return 'tag';
  if (raw.startsWith('{')) return 'placeholder';
  if (raw.startsWith('[')) return 'infill';
  if (raw.startsWith('`')) return 'highlight';
  if (raw === '🎯') return 'attention';
  return 'text';
}

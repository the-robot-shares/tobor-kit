/** Shared shapes for the wiki family. Property-only — never HTML attributes. */

export interface WikiSpace {
  id: string;
  title: string;
  slug?: string;
}

export interface WikiEntry {
  id: string;
  title: string;
  body: string;
  spaceId?: string;
}

export interface WikiSpaceSelectDetail {
  id: string;
}

export interface WikiEditDetail {
  id: string;
}

export interface WikiSaveDetail {
  id: string;
  title: string;
  body: string;
  spaceId?: string;
}

/**
 * Body is xhtml-first / NPL source. Always characters — never parsed HTML.
 * Lit interpolation + `<pre>` keep markup visible as text.
 */
export function wikiPlainText(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

export const SAMPLE_SPACES: WikiSpace[] = [
  {id: 'eng', title: 'Engineering', slug: 'eng'},
  {id: 'ops', title: 'Ops'},
];

export const SAMPLE_ENTRY: WikiEntry = {
  id: 'eng-readme',
  title: 'README',
  body: 'Ship the island.\nDo not render HTML.\n<section>stays source</section>',
  spaceId: 'eng',
};

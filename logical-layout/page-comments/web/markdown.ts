/**
 * Minimal safe Markdown renderer for comment bodies.
 *
 * The kit ships no markdown dependency (CDN prep rejects extra externals), so
 * this covers the small surface comment threads need: paragraphs, line
 * breaks, `**bold**`, `*italic*`, `` `code` ``, fenced code blocks, `- `
 * lists and `[text](https://…)` links. Everything is HTML-escaped FIRST —
 * the renderer never emits raw host markup, so `<script>` in a comment stays
 * visible text. Links are http/https only and get `rel="noopener
 * noreferrer"`.
 */

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPE[ch] ?? ch);
}

function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\//.test(trimmed)) return trimmed; // same-origin relative
  return null;
}

function inline(text: string): string {
  let out = escapeHtml(text);
  const stash: string[] = [];
  const keep = (html: string): string => {
    stash.push(html);
    return `\u0000${stash.length - 1}\u0000`;
  };

  // Code spans first so their content is not re-marked-up.
  out = out.replace(/`([^`]+)`/g, (_, code: string) => keep(`<code>${code}</code>`));
  // Links: [text](url). The whole text was HTML-escaped above, so both
  // label and url are already escaped exactly once — reuse them as-is.
  // Escaping again would double-escape (`&` → `&amp;amp;`) and break
  // query-string links; the escaped form is attribute-safe because `"`
  // became `&quot;` and no raw `<`/`>` survive.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label: string, url: string) => {
    const safe = safeUrl(url);
    return safe ? keep(`<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`) : all;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, body: string) => `<strong>${body}</strong>`);
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, (_, lead: string, body: string) => `${lead}<em>${body}</em>`);
  return out.replace(/\u0000(\d+)\u0000/g, (_, index: string) => stash[Number(index)] ?? "");
}

/** Render markdown to a sanitized HTML string (no raw host markup passes). */
export function renderMarkdown(source: string): string {
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;
  let fence: string[] | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list?.length) {
      html.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      list = null;
    }
  };

  for (const line of lines) {
    if (fence !== null) {
      if (/^```/.test(line.trim())) {
        html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }
    if (/^```/.test(line.trim())) {
      flushParagraph();
      flushList();
      fence = [];
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      list = list ?? [];
      list.push(bullet[1]);
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  if (fence?.length) html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
  return html.join("");
}

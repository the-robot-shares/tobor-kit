// Builds a single self-contained MHTML showcase report for the isolation lane.
// Usage: node scripts/generate-isolation-report.mjs [--log <cypress-run.log>]
// Inputs: web/registry.yaml, web/e2e/isolation/*.cy.ts, web/cypress/screenshots/<spec>/*.png,
//         web/cypress/videos/isolation/<spec>.cy.ts.mp4
// Output: web/cypress/report/tobor-kit-components.mhtml
import {createWriteStream} from 'node:fs';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, basename, join} from 'node:path';

const WEB = resolve(import.meta.dirname, '..');
const SHOTS = join(WEB, 'cypress/screenshots');
const VIDEOS = join(WEB, 'cypress/videos/isolation');
const OUT_DIR = join(WEB, 'cypress/report');
const OUT = join(OUT_DIR, 'tobor-kit-components.mhtml');

// ---------- minimal registry.yaml parser (subset: lists, cy_prefix, notes) ----------
function parseRegistry(text) {
  const elements = {};
  let current = null;
  let inNotes = false;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const el = line.match(/^  ([a-z][a-z0-9-]+):\s*$/);
    if (el) {
      current = el[1];
      elements[current] = {attrs: [], slots: [], events: [], notes: ''};
      inNotes = false;
      continue;
    }
    if (!current) continue;
    if (/^    notes:/.test(line)) {
      inNotes = true;
      const inline = line.replace(/^    notes:\s*>?\s*/, '').trim();
      if (inline) elements[current].notes = inline;
      continue;
    }
    if (inNotes) {
      if (/^      /.test(line)) {
        elements[current].notes += ' ' + line.trim();
      } else {
        inNotes = false;
      }
    }
    if (!inNotes) {
      for (const key of ['attrs', 'slots', 'events']) {
        const m = line.match(new RegExp(`^    ${key}: \\[(.*)\\]\\s*$`));
        if (m) elements[current][key] = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  for (const e of Object.values(elements)) e.notes = e.notes.replace(/\s+/g, ' ').trim();
  return elements;
}

// ---------- family model ----------
// spec file base name -> {tags, group}. Groups per portfolio placement:
// Roster (persona/party cards), Agent-kit surfaces (workbench/domain tooling),
// Styleguide conversions (noizu-sg-*), Site & marketing (public widgets).
const GROUPS = [
  ['Roster', ['persona', 'party-card', 'agent-card', 'user-card', 'robot-avatar']],
  ['Agent-kit surfaces', ['task-menu', 'tool-list', 'mcp-domain', 'mcp-config', 'mcp-clients', 'prompt', 'npl-view', 'wiki', 'review-panel', 'asset', 'artifact', 'chat-thread', 'voice-agent', 'voice-session', 'transcript-view', 'configurator', 'model-config', 'plan-compare', 'mode-toggle', 'telemetry-toggle', 'guide-panel']],
  ['Styleguide conversions', ['styleguide']],
  ['Site & marketing', ['waitlist', 'cookie', 'faq', 'auth', 'login-flow', 'human-verify', 'subscription-gate', 'invite-gate', 'billing-status', 'phone-input']],
];

function groupFor(specBase) {
  for (const [g, names] of GROUPS) {
    for (const n of names) if (specBase === n || specBase.startsWith(n + '-') || specBase.startsWith(n + '_')) return g;
  }
  return 'Other';
}

async function tagsForSpec(specFile) {
  const src = await readFile(join(WEB, 'e2e/isolation', specFile), 'utf8');
  const tags = new Set();
  for (const m of src.matchAll(/['"]((?:noizu|tobor)-[a-z0-9-]+)['"]/g)) tags.add(m[1]);
  // prefer actually-mounted tags
  const mounted = new Set();
  for (const m of src.matchAll(/mount\(\s*['"]([a-z][a-z0-9-]+)['"]/g)) mounted.add(m[1]);
  return [...(mounted.size ? mounted : tags)];
}

async function main() {
  const args = process.argv.slice(2);
  const logIdx = args.indexOf('--log');
  const logPath = logIdx >= 0 ? args[logIdx + 1] : null;

  const registry = parseRegistry(await readFile(join(WEB, 'registry.yaml'), 'utf8'));
  const specFiles = (await readdir(join(WEB, 'e2e/isolation'))).filter((f) => f.endsWith('.cy.ts')).sort();

  // parse run log for per-spec pass/fail counts (cypress spec reporter text)
  const results = {}; // specBase -> {pass, fail}
  if (logPath && existsSync(logPath)) {
    const log = await readFile(logPath, 'utf8');
    const specBlocks = log; // per-spec sections in cypress spec-reporter output
    for (const f of specFiles) {
      const block = specBlocks.match(new RegExp(`${f.replace(/\./g, '\\.')}[\\s\\S]{0,8000}?(\\d+ passing[^]*?)(?=\\n  [\\w-]+\\.cy\\.ts\\n|\\n\\(Results\\)|$)`, 'm'));
      if (block) {
        const pass = /(\d+) passing/.exec(block[1]);
        const fail = /(\d+) failing/.exec(block[1]);
        results[f.replace('.cy.ts', '')] = {pass: pass ? +pass[1] : 0, fail: fail ? +fail[1] : 0};
      }
    }
  }

  // collect media
  const boundary = '----toborkit-mhtml-' + Date.now().toString(36);
  const parts = []; // {headers:{}, body:Buffer}
  const cid = (s) => `cid:${s}`;

  const families = [];
  for (const specFile of specFiles) {
    const base = specFile.replace('.cy.ts', '');
    const tags = await tagsForSpec(specFile);
    const shotDir = join(SHOTS, specFile);
    let shots = [];
    if (existsSync(shotDir)) shots = (await readdir(shotDir)).filter((f) => f.endsWith('.png')).sort();
    let video = join(VIDEOS, specFile + '.mp4');
    if (!existsSync(video)) video = null;
    const r = results[base] ?? {pass: null, fail: null};
    families.push({base, specFile, tags, shots, video, ...r, group: groupFor(base)});
  }

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let html = `<!doctype html><html><head><meta charset="utf-8"><title>tobor-kit component showcase</title>
<style>
body{font:14px/1.5 -apple-system,Segoe UI,sans-serif;margin:2rem auto;max-width:900px;color:#1a1a2e}
h1{border-bottom:2px solid #4f46e5;padding-bottom:.3rem}
h2.family{margin-top:2.5rem;background:#eef2ff;padding:.5rem .8rem;border-radius:6px}
h3.group{margin-top:3rem;color:#4f46e5;text-transform:uppercase;letter-spacing:.08em;font-size:.85rem}
table{border-collapse:collapse;margin:.5rem 0;width:100%}
td,th{border:1px solid #d4d4d8;padding:.3rem .6rem;text-align:left;vertical-align:top;font-size:13px}
th{background:#f4f4f5}
.shots img{max-width:100%;border:1px solid #d4d4d8;margin:.5rem 0}
.badge{display:inline-block;padding:.1rem .5rem;border-radius:99px;font-size:12px;font-weight:600}
.pass{background:#dcfce7;color:#166534}.fail{background:#fee2e2;color:#991b1b}.na{background:#f4f4f5;color:#52525b}
code{background:#f4f4f5;padding:.05rem .3rem;border-radius:4px;font-size:12px}
video{max-width:100%}
summary{cursor:pointer;margin:.5rem 0}
</style></head><body>
<h1>tobor-kit component showcase</h1>
<p>Isolated-component lane report — ${families.length} families, generated ${new Date().toISOString()}.
Each family mounts on the blank harness (<code>e2e/isolation/harness.html</code>) with all backend calls mocked.</p>
`;
  const grouped = {};
  for (const f of families) (grouped[f.group] ??= []).push(f);

  for (const [group, list] of Object.entries(grouped)) {
    html += `<h3 class="group">${esc(group)}</h3>\n`;
    for (const f of list) {
      const status = f.fail != null && f.fail > 0
        ? `<span class="badge fail">FAIL ${f.fail}</span>`
        : f.pass != null
          ? `<span class="badge pass">PASS ${f.pass}</span>`
          : '<span class="badge na">n/a</span>';
      html += `<section class="family" id="${esc(f.base)}">\n<h2 class="family">${f.tags.map(esc).join(' · ')} &nbsp; ${status}</h2>\n`;
      html += `<p><em>Family:</em> ${esc(f.base)} · <em>Spec:</em> <code>e2e/isolation/${f.specFile}</code></p>\n`;
      for (const tag of f.tags) {
        const el = registry[tag];
        if (!el) {
          html += `<p><em>(not in registry.yaml)</em></p>`;
          continue;
        }
        if (el.notes) html += `<p>${esc(el.notes)}</p>\n`;
        html += `<table><tr><th>attrs</th><th>slots</th><th>events</th></tr><tr><td>${el.attrs.map(esc).join('<br>') || '—'}</td><td>${el.slots.map(esc).join('<br>') || '—'}</td><td>${el.events.map((e) => `<code>${esc(e)}</code>`).join('<br>') || '—'}</td></tr></table>\n`;
      }
      if (f.shots.length) {
        html += `<div class="shots"><p><strong>States captured:</strong></p>`;
        for (const shot of f.shots) {
          const name = shot.replace(/\.png$/, '');
          const c = `shot-${f.base}-${name}`;
          parts.push({headers: {'Content-Type': 'image/png', 'Content-Transfer-Encoding': 'base64', 'Content-ID': `<${c}>`}, body: await readFile(join(SHOTS, f.specFile, shot))});
          const label = name.replace(/^[a-z0-9-]+?-[a-z0-9-]+?[-]/, '');
          html += `<figure><img src="${cid(c)}" alt="${esc(name)}"><figcaption>${esc(name)}</figcaption></figure>`;
        }
        html += `</div>`;
      }
      if (f.video) {
        const c = `video-${f.base}`;
        const loc = `videos/${basename(f.video)}`;
        parts.push({headers: {'Content-Type': 'video/mp4', 'Content-Transfer-Encoding': 'base64', 'Content-Location': loc, 'Content-ID': `<${c}>`}, body: await readFile(f.video)});
        html += `<details><summary>Run recording (${esc(basename(f.video))})</summary><video controls src="${loc}"></video><p><a href="${loc}">open video</a></p></details>\n`;
      } else {
        html += `<p><em>(no recording for this family)</em></p>`;
      }
      html += `</section>\n`;
    }
  }
  html += `</body></html>`;

  parts.unshift({
    headers: {'Content-Type': 'text/html; charset=utf-8', 'Content-Transfer-Encoding': 'base64', 'Content-Location': 'report.html', 'Content-ID': '<report-root>'},
    body: Buffer.from(html, 'utf8'),
  });

  // MHTML requires CRLF line endings throughout (headers, delimiters, blank lines).
  const CRLF = '\r\n';
  const b64 = (buf) => buf.toString('base64').replace(/(.{76})/g, '$1' + CRLF);
  const chunks = [];
  chunks.push(
    Buffer.from(
      `From: <tobor-kit isolation lane>${CRLF}` +
      `Subject: tobor-kit component showcase${CRLF}` +
      `Date: ${new Date().toUTCString()}${CRLF}` +
      `MIME-Version: 1.0${CRLF}` +
      `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"${CRLF}${CRLF}`,
      'utf8',
    ),
  );
  for (const p of parts) {
    let head = `--${boundary}${CRLF}`;
    for (const [k, v] of Object.entries(p.headers)) head += `${k}: ${v}${CRLF}`;
    head += CRLF;
    chunks.push(Buffer.from(head, 'utf8'), Buffer.from(b64(p.body) + CRLF, 'utf8'));
  }
  chunks.push(Buffer.from(`--${boundary}--${CRLF}`, 'utf8'));
  const out = Buffer.concat(chunks);

  // Fallback for mp4-in-MHTML quirks: write videos alongside the report; the HTML
  // references them via relative Content-Location paths, which resolve when the
  // .mhtml is opened from this folder.
  await mkdir(OUT_DIR, {recursive: true});
  await writeFile(OUT, out);
  for (const p of parts) {
    const loc = p.headers['Content-Location'];
    if (loc && p.headers['Content-Type'] === 'video/mp4') {
      await mkdir(join(OUT_DIR, 'videos'), {recursive: true});
      await writeFile(join(OUT_DIR, loc), p.body);
    }
  }

  // sanity: MIME structure
  const text = out.toString('utf8');
  const partCount = (text.match(new RegExp(`^--${boundary}$`, 'gm')) || []).length;
  const cids = (text.match(/Content-ID: <[^>]+>/g) || []).length;
  const summary = {out: OUT, bytes: Buffer.byteLength(out), parts: partCount, htmlRoots: (text.match(/text\/html/g) || []).length, images: (text.match(/image\/png/g) || []).length, videos: (text.match(/video\/mp4/g) || []).length, cids};
  console.log(JSON.stringify(summary, null, 2));
  if (summary.parts !== parts.length) throw new Error('boundary count mismatch');
  if (summary.cids !== parts.length) throw new Error('cid count mismatch');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

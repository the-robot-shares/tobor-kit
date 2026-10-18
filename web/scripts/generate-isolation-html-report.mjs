// Builds a plain-HTML showcase report with relative asset references (no embedding),
// the reliable alternative to the MHTML report.
// Usage: node scripts/generate-isolation-html-report.mjs [--log <cypress-run.log>]
// Output: web/cypress/report/artifacts/index.html + assets/<family>/...
import {readFile, readdir, mkdir, writeFile, rm, stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, basename, join, relative} from 'node:path';

const WEB = resolve(import.meta.dirname, '..');
const SHOTS = join(WEB, 'cypress/screenshots');
const VIDEOS = join(WEB, 'cypress/videos/isolation');
const ART_DIR = join(WEB, 'cypress/report/artifacts');
const ASSETS = join(ART_DIR, 'assets');

// ---------- minimal registry.yaml parser (same subset as generate-isolation-report.mjs) ----------
function parseRegistry(text) {
  const elements = {};
  let current = null;
  let inNotes = false;
  const lines = text.split('\n');
  for (const line of lines) {
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

// ---------- family model (same grouping as the MHTML report) ----------
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
  const mounted = new Set();
  for (const m of src.matchAll(/mount\(\s*['"]([a-z][a-z0-9-]+)['"]/g)) mounted.add(m[1]);
  return [...(mounted.size ? mounted : tags)];
}

async function dirSize(p) {
  let total = 0;
  for (const e of await readdir(p, {withFileTypes: true})) {
    const fp = join(p, e.name);
    total += e.isDirectory() ? await dirSize(fp) : (await stat(fp)).size;
  }
  return total;
}

async function main() {
  const args = process.argv.slice(2);
  const logIdx = args.indexOf('--log');
  const logPath = logIdx >= 0 ? args[logIdx + 1] : join(WEB, 'cypress/report/cypress-run.log');

  const registry = parseRegistry(await readFile(join(WEB, 'registry.yaml'), 'utf8'));
  const specFiles = (await readdir(join(WEB, 'e2e/isolation'))).filter((f) => f.endsWith('.cy.ts')).sort();

  // per-spec pass/fail counts from the spec-reporter log
  const results = {};
  if (logPath && existsSync(logPath)) {
    const log = await readFile(logPath, 'utf8');
    for (const f of specFiles) {
      const block = log.match(new RegExp(`${f.replace(/\./g, '\\.')}[\\s\\S]{0,8000}?(\\d+ passing[^]*?)(?=\\n  [\\w-]+\\.cy\\.ts\\n|\\n\\(Results\\)|$)`, 'm'));
      if (block) {
        const pass = /(\d+) passing/.exec(block[1]);
        const fail = /(\d+) failing/.exec(block[1]);
        results[f.replace('.cy.ts', '')] = {pass: pass ? +pass[1] : 0, fail: fail ? +fail[1] : 0};
      }
    }
  }

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const missing = [];
  const written = [];

  // clean slate
  await rm(ART_DIR, {recursive: true, force: true});
  await mkdir(ASSETS, {recursive: true});

  const families = [];
  for (const specFile of specFiles) {
    const base = specFile.replace('.cy.ts', '');
    const tags = await tagsForSpec(specFile);
    const famDir = join(ASSETS, base);
    await mkdir(famDir, {recursive: true});
    const shots = [];
    const shotDir = join(SHOTS, specFile);
    if (existsSync(shotDir)) {
      for (const f of (await readdir(shotDir)).filter((f) => f.endsWith('.png')).sort()) {
        const src = join(shotDir, f);
        await writeFile(join(famDir, f), await readFile(src));
        shots.push(f);
        written.push(join(famDir, f));
      }
    }
    let video = null;
    const vsrc = join(VIDEOS, specFile + '.mp4');
    if (existsSync(vsrc)) {
      video = `${specFile}.mp4`;
      await writeFile(join(famDir, video), await readFile(vsrc));
      written.push(join(famDir, video));
    }
    families.push({base, specFile, tags, shots, video, group: groupFor(base), ...(results[base] ?? {pass: null, fail: null})});
  }

  // ---------- HTML ----------
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>tobor-kit component showcase</title>
<style>
body{font:14px/1.5 -apple-system,Segoe UI,sans-serif;margin:2rem auto;max-width:960px;color:#1a1a2e}
h1{border-bottom:2px solid #4f46e5;padding-bottom:.3rem}
h2.family{margin-top:2.5rem;background:#eef2ff;padding:.5rem .8rem;border-radius:6px}
h3.group{margin-top:3rem;color:#4f46e5;text-transform:uppercase;letter-spacing:.08em;font-size:.85rem}
table{border-collapse:collapse;margin:.5rem 0;width:100%}
td,th{border:1px solid #d4d4d8;padding:.3rem .6rem;text-align:left;vertical-align:top;font-size:13px}
th{background:#f4f4f5}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.8rem}
.shots figure{margin:0}
.shots img{width:100%;height:auto;border:1px solid #d4d4d8;border-radius:4px}
figcaption{font-size:12px;color:#52525b;word-break:break-all}
.badge{display:inline-block;padding:.1rem .5rem;border-radius:99px;font-size:12px;font-weight:600}
.pass{background:#dcfce7;color:#166534}.fail{background:#fee2e2;color:#991b1b}.na{background:#f4f4f5;color:#52525b}
code{background:#f4f4f5;padding:.05rem .3rem;border-radius:4px;font-size:12px}
video{max-width:100%}
summary{cursor:pointer;margin:.5rem 0}
details{margin:.5rem 0}
</style></head><body>
<h1>tobor-kit component showcase</h1>
<p>Isolated-component lane report — ${families.length} families, generated ${new Date().toISOString()}.
Each family mounts on the blank harness (<code>e2e/isolation/harness.html</code>) with all backend calls mocked.
Plain HTML with relative asset paths — no JS, no embedding.</p>
`;
  const grouped = {};
  for (const f of families) (grouped[f.group] ??= []).push(f);

  const rel = (fam, p) => `assets/${fam}/${p}`;

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
        html += `<div class="shots">`;
        for (const shot of f.shots) {
          const src = rel(f.base, shot);
          html += `<figure><a href="${esc(src)}"><img src="${esc(src)}" alt="${esc(shot)}" loading="lazy"></a><figcaption>${esc(shot)}</figcaption></figure>`;
        }
        html += `</div>`;
      }
      if (f.video) {
        const src = rel(f.base, f.video);
        html += `<details><summary>Run recording (${esc(f.video)})</summary><video controls preload="none" src="${esc(src)}"></video></details>\n`;
      } else {
        html += `<p><em>(no recording for this family)</em></p>`;
      }
      html += `</section>\n`;
    }
  }
  html += `</body></html>`;
  const htmlPath = join(ART_DIR, 'index.html');
  await writeFile(htmlPath, html);

  // ---------- sanity: every referenced file must exist on disk ----------
  const refs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((m) => m[1]);
  for (const r of refs) {
    const fp = join(ART_DIR, r);
    if (!existsSync(fp)) missing.push(r);
  }
  if (missing.length) throw new Error(`unresolved references: ${missing.join(', ')}`);

  const size = await dirSize(ART_DIR);
  console.log(JSON.stringify({
    out: htmlPath,
    families: families.length,
    images: refs.filter((r) => r.endsWith('.png')).length,
    videos: refs.filter((r) => r.endsWith('.mp4')).length,
    filesWritten: written.length + 1,
    bytes: size,
    humanSize: `${(size / 1024 / 1024).toFixed(1)} MB`,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

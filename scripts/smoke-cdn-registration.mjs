// Gate: every CDN component entry registers its own tag(s) when imported ALONE.
//
// smoke-cdn.mjs imports index.js, which registers everything and would hide an
// entry that defines nothing. Here each `components/<family>/<element>.js` gets
// a fresh page (fresh registry), is imported on its own, and must define every
// tag its source declares with @defineElement. A second copy of the same entry
// (a distinct URL, so a distinct module graph and class) is then imported into
// the same page: it must not throw, and the first definition must win.
import {createServer} from 'node:http';
import {readFile, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {createRequire} from 'node:module';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'web/cdn-dist');
const src = join(root, 'web/src');
const require = createRequire(resolve(root, 'web/package.json'));
const {default: puppeteer} = await import(require.resolve('puppeteer-core'));

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else if (path.endsWith('.js')) out.push(path);
  }
  return out;
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const found = candidates.find(path => existsSync(path));
  if (!found) throw new Error(`No Chrome/Chromium found (tried ${candidates.join(', ')}); set CHROME_PATH`);
  return found;
}

const tagsIn = source => [...source.matchAll(/@defineElement\(\s*["']([a-z][a-z0-9-]*)["']\s*\)/g)].map(m => m[1]);

const cases = [];
const allTags = new Set();
for (const path of await walk(join(dist, 'components'))) {
  const rel = relative(dist, path);
  const ts = join(src, rel.replace(/\.js$/, '.ts'));
  if (!existsSync(ts)) continue;
  const tags = tagsIn(await readFile(ts, 'utf8'));
  if (!tags.length) continue; // helper entry (catalog, store, adapter index)
  tags.forEach(tag => allTags.add(tag));
  cases.push({entry: `/${rel}`, tags});
}
if (cases.length === 0) throw new Error('No component entries found in web/cdn-dist — run prepare-cdn first');

// Every element the source declares must be reachable from some entry.
// An element on Lit's @customElement would be invisible to this gate (and not
// idempotent), so it is a failure in its own right.
const declared = new Set();
const litDecorated = [];
for (const path of await readdir(join(src, 'components'), {recursive: true})) {
  if (!path.endsWith('.ts') || path.includes('/test/') || path.endsWith('.test.ts')) continue;
  const source = await readFile(join(src, 'components', path), 'utf8');
  tagsIn(source).forEach(tag => declared.add(tag));
  if (/@customElement\(/.test(source)) litDecorated.push(path);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://x');
    if (url.pathname === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>CDN registration gate</title>');
      return;
    }
    // /dup/... serves the same tree under a second URL: a second kit copy.
    const path = url.pathname.startsWith('/dup/') ? url.pathname.slice(4) : url.pathname;
    response.setHeader('Content-Type', 'text/javascript');
    response.end(await readFile(join(dist, `.${path}`)));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const failures = [];
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true, args: ['--no-sandbox'],
  });
  for (const {entry, tags} of cases) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/`);
    const result = await page.evaluate(async ({entry, tags}) => {
      const out = {missing: [], replaced: [], error: null};
      try {
        await import(entry);
        const first = Object.fromEntries(tags.map(tag => [tag, customElements.get(tag)]));
        out.missing = tags.filter(tag => !first[tag]);
        await import(`/dup${entry}`);
        out.replaced = tags.filter(tag => customElements.get(tag) !== first[tag]);
      } catch (error) {
        out.error = String(error);
      }
      return out;
    }, {entry, tags});
    await page.close();
    const problems = [];
    if (result.error) problems.push(`import threw: ${result.error}`);
    if (result.missing.length) problems.push(`not defined: ${result.missing.join(', ')}`);
    if (result.replaced.length) problems.push(`second copy replaced: ${result.replaced.join(', ')}`);
    if (errors.length) problems.push(`page errors: ${errors.join(' | ')}`);
    if (problems.length) failures.push(`${entry}: ${problems.join('; ')}`);
  }
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}

if (litDecorated.length) failures.push(`use @defineElement (src/define.ts), not @customElement: ${litDecorated.join(', ')}`);
const unreachable = [...declared].filter(tag => !allTags.has(tag));
if (unreachable.length) failures.push(`tags with no CDN entry: ${unreachable.join(', ')}`);

if (failures.length) {
  console.error(`CDN registration gate FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`CDN registration gate passed: ${cases.length} entries, ${allTags.size} tags self-register, second copies are no-ops`);

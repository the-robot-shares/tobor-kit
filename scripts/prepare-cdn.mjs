// Keep npm's peer dependencies external; resolve them only in the CDN copy.
import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {createHash} from 'node:crypto';

const sha = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Expected full commit SHA');
const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'web/cdn-dist');
await rm(dist, {recursive: true, force: true});
await mkdir(dist, {recursive: true});
await cp(join(root, 'web/dist'), dist, {recursive: true,
  filter: path => !path.endsWith('.map') && !['react.js', 'react.d.ts'].includes(path.split('/').at(-1))});
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(dist);
for (const path of files.filter(path => path.endsWith('.js'))) {
  // Vendor bundles are self-contained single-file builds (no bare imports)
  // and their minified string literals trip the loose import regex — skip.
  if (path.includes(`${dist}/vendor/`)) continue;
  let source = await readFile(path, 'utf8');
  source = source.replace(/(\bfrom\s*|\bimport\s*|\bimport\s*\(\s*)(["'])([^"']+)\2/g,
    (match, prefix, quote, specifier) => {
      if (specifier.startsWith('.') || specifier.startsWith('/')) return match;
      const vendor = {
        'lit': 'vendor/lit.js',
        'lit/decorators.js': 'vendor/lit-decorators.js',
        'lit/directives/class-map.js': 'vendor/lit-directives-class-map.js',
        'lit/directives/style-map.js': 'vendor/lit-directives-style-map.js',
        'lit/directives/live.js': 'vendor/lit-directives-live.js',
        'lit/directives/if-defined.js': 'vendor/lit-directives-if-defined.js',
        'lit/directives/unsafe-html.js': 'vendor/lit-directives-unsafe-html.js',
        '@zumer/snapdom': 'vendor/snapdom.js',
        'phoenix': 'vendor/phoenix.js',
      }[specifier];
      if (!vendor) throw new Error(`Unsupported browser import ${specifier} in ${path}`);
      let target = relative(dirname(path), join(dist, vendor));
      if (!target.startsWith('.')) target = `./${target}`;
      return `${prefix}${quote}${target}${quote}`;
    });
  // Source maps describe the npm build before import rewriting; omit their link.
  source = source.replace(/^\/\/# sourceMappingURL=.*$/gm, '');
  await writeFile(path, source);
}
const baseUrl = `https://cdn.derobot.is/tobor-kit/sha-${sha}/`;
const integrity = {};
for (const path of files.filter(path => path.endsWith('.js'))) {
  integrity[relative(dist, path)] = `sha384-${createHash('sha384').update(await readFile(path)).digest('base64')}`;
}
const {version} = JSON.parse(await readFile(join(root, 'web/package.json'), 'utf8'));
await writeFile(join(dist, 'manifest.json'), JSON.stringify({sha, version, baseUrl,
  entry: `${baseUrl}index.js`, auth: `${baseUrl}components/auth/noizu-auth.js`, integrity}, null, 2) + '\n');
console.log(`Prepared browser-native Lit modules: ${baseUrl}`);

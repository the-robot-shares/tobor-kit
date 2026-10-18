// Regenerates e2e/isolation/lit-importmap.json and re-inlines it into
// e2e/isolation/harness.html. The harness needs the full lit package graph
// (incl. bare @lit/* specifiers) resolved from node_modules so dist/ component
// builds and the page share one lit instance. Run after bumping lit.
import {execSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';

const PACKAGES = ['lit', 'lit-html', 'lit-element', '@lit/reactive-element', '@lit-labs/ssr-dom-shim'];
const ENTRIES = {
  lit: '/node_modules/lit/index.js',
  'lit-html': '/node_modules/lit-html/lit-html.js',
  'lit-element': '/node_modules/lit-element/lit-element.js',
  '@lit/reactive-element': '/node_modules/@lit/reactive-element/reactive-element.js',
  '@lit-labs/ssr-dom-shim': '/node_modules/@lit-labs/ssr-dom-shim/index.js',
};

const imports = {...ENTRIES};
for (const pkg of PACKAGES) {
  const files = execSync(`find node_modules/${pkg} -name "*.js" -type f`, {encoding: 'utf8'})
    .trim()
    .split('\n');
  for (const file of files) imports[file.replace(/^node_modules\//, '')] = `/${file}`;
}

const map = JSON.stringify({imports}, null, 2);
writeFileSync('e2e/isolation/lit-importmap.json', map);

let html = readFileSync('e2e/isolation/harness.html', 'utf8');
const start = html.indexOf('<script type="importmap">');
const end = html.indexOf('</script>', start) + '</script>'.length;
if (start === -1 || end < start) throw new Error('importmap script tag not found in harness.html');
html = html.slice(0, start) + `<script type="importmap">${JSON.stringify({imports})}</script>` + html.slice(end);
writeFileSync('e2e/isolation/harness.html', html);
console.log(`isolation import map: ${Object.keys(imports).length} entries written`);

#!/usr/bin/env node
/**
 * Derive gitignored custom-element stubs from registry.yaml.
 * Stubs are a pure function of the name directory — never commit .stubs/.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const yaml = await readFile(join(root, 'registry.yaml'), 'utf8');

const elements = [];
let current = null;
for (const raw of yaml.split('\n')) {
  const line = raw.replace(/\t/g, '  ');
  const el = line.match(/^  ([a-z0-9-]+):$/);
  if (el && !line.startsWith('    ')) {
    current = {tag: el[1], attrs: []};
    elements.push(current);
    continue;
  }
  if (!current) continue;
  const attrs = line.match(/^    attrs: \[(.*)\]$/);
  if (attrs) {
    current.attrs = attrs[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

const stubDir = join(root, '.stubs');
await mkdir(stubDir, {recursive: true});

const attrType = (name) =>
  `    '${name}'?: string;\n    '${name.replace(/-/g, '')}'?: string;`;

let jsx = `export {};\n\ndeclare global {\n  namespace JSX {\n    interface IntrinsicElements {\n`;
for (const el of elements) {
  const className = el.tag
    .split('-')
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join('');
  const file = join(stubDir, `${el.tag}.js`);
  await writeFile(
    file,
    `export class ${className} extends HTMLElement {}\n` +
      `if (!customElements.get('${el.tag}')) customElements.define('${el.tag}', ${className});\n`,
  );
  jsx += `      '${el.tag}': {\n`;
  for (const a of el.attrs) jsx += attrType(a);
  jsx += `        children?: unknown;\n      };\n`;
}
jsx += `    }\n  }\n}\n`;
await writeFile(join(stubDir, 'jsx.d.ts'), jsx);

const index = elements.map((el) => `import './${el.tag}.js';`).join('\n') + '\n';
await writeFile(join(stubDir, 'index.js'), index);

console.log(`wrote ${elements.length} stubs to .stubs/`);

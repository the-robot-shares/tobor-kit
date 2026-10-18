import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';

// Serves the whole web/ tree so /e2e/isolation/harness.html can import
// built components from /dist/** and mock JSON from /e2e/isolation/fixtures/**.
const root = resolve('.');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!(await stat(file)).isFile()) throw new Error('missing');
    res.writeHead(200, {'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store'});
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('Not found. Run npm run build first.');
  }
});
server.listen(Number(process.env.PORT ?? 8091), '127.0.0.1', () =>
  console.log('Isolation harness: http://127.0.0.1:8091/e2e/isolation/harness.html'),
);

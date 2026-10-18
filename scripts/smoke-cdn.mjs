// Exercise the actual published modules with native browser imports (no import map).
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const root = resolve(import.meta.dirname, '..');
const require = createRequire(resolve(root, 'web/package.json'));
const {default: puppeteer} = await import(require.resolve('puppeteer-core'));
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>CDN smoke</title>');
      return;
    }
    response.setHeader('Content-Type', 'text/javascript');
    response.end(await readFile(resolve(root, 'web/cdn-dist', `.${request.url}`)));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome'),
    headless: true, args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async () => {
    await import('/components/auth/noizu-auth.js');
    await import('/index.js');
    for (const name of ['noizu-auth', 'noizu-waitlist', 'noizu-faq']) {
      if (!customElements.get(name)) throw new Error(`Missing ${name}`);
    }
    const auth = document.createElement('noizu-auth');
    document.body.append(auth);
    await auth.updateComplete;
    if (!auth.shadowRoot?.querySelector('form')) throw new Error('Auth form did not render');
  });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('CDN smoke passed: native browser imports and auth rendering');
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}

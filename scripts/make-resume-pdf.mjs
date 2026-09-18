/**
 * Renders /resume from the built site into public/Nick-Soderstrom-Resume.pdf.
 *
 *   npm run build && npm run resume:pdf
 *
 * Needs Playwright with Chromium. Install it once with
 * `npm i -D playwright && npx playwright install chromium`, or point
 * PLAYWRIGHT_MODULE at an existing install.
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const out = new URL('../public/Nick-Soderstrom-Resume.pdf', import.meta.url).pathname;

if (!existsSync(join(dist, 'resume', 'index.html'))) {
  console.error('dist/resume/index.html not found. Run `npm run build` first.');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Playwright not found. Install it or set PLAYWRIGHT_MODULE to its index.mjs.');
  process.exit(1);
}

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let path = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader('content-type', types[extname(path)] || 'application/octet-stream');
  createReadStream(path).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/resume/`, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: out, format: 'Letter', printBackground: true, preferCSSPageSize: true });
await browser.close();
server.close();
console.log(`Wrote ${out}`);

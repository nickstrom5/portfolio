/**
 * Recaptures the screenshots of this site that /apps/ shows ("The site
 * you're reading was built the same way"), from the built site, at 2x for
 * sharp Retina displays. Run after a visible change to the home, clients or
 * about page:
 *
 *   npm run build && npm run shots
 *
 * `npm run shots -- clam` also refreshes the getclam.app screenshot from the
 * live site. Astro resizes the 2880px masters for each screen, so their size
 * never reaches visitors. Needs Playwright with Chromium.
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { readFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url).pathname;
const out = (name) => new URL(`../src/assets/showcase/${name}`, import.meta.url).pathname;
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Playwright not found. Run `npx playwright install chromium`, or set PLAYWRIGHT_MODULE.');
  process.exit(1);
}

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.avif': 'image/avif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
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
const base = `http://127.0.0.1:${server.address().port}`;

const shots = [
  { url: `${base}/`, file: 'site-home.jpg' },
  { url: `${base}/clients/`, file: 'site-clients.jpg' },
  { url: `${base}/about/`, file: 'site-about.jpg' },
];
if (process.argv.includes('clam')) shots.push({ url: 'https://getclam.app/', file: 'clam-site.jpg', live: true });

const inter = readFileSync(new URL('../src/assets/fonts/inter-latin-var.woff2', import.meta.url)).toString('base64');
const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', ignoreHTTPSErrors: !!s.live, bypassCSP: !!s.live });
  const page = await ctx.newPage();
  // Live sites get a few tries; a flaky connection should not lose the run.
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(s.url, { waitUntil: 'networkidle' });
      break;
    } catch (e) {
      if (!s.live || attempt === 3) throw e;
      await page.waitForTimeout(2000 * attempt);
    }
  }
  // Inter loads with font-display: optional, so the first visit may paint the fallback. Load again from cache.
  await page.reload({ waitUntil: 'networkidle' });
  // Live sites set in Apple's system font fall back to DejaVu on Linux; Inter is the close stand-in.
  if (s.live) await page.addStyleTag({ content: `@font-face { font-family: 'Inter Shot'; src: url(data:font/woff2;base64,${inter}) format('woff2'); font-weight: 100 900; } body, body * { font-family: 'Inter Shot', sans-serif !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out(s.file), type: 'jpeg', quality: 82 });
  console.log(`Wrote src/assets/showcase/${s.file}`);
  await ctx.close();
}
await browser.close();
server.close();

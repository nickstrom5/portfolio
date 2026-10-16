/**
 * Recaptures the screenshots of this site that /apps/ shows ("This website"):
 * the home, clients and about pages, from the built site, at 1440x900 and 2x
 * for sharp Retina displays. Run after a visible change to one of those pages:
 *
 *   npm run build && npm run shots && npm run build
 *
 * Writes src/assets/showcase/site-home.jpg, site-clients.jpg and
 * site-about.jpg (2880x1800). Astro resizes them for each screen, so the
 * masters' size never reaches visitors. The files are encoded with sharp and
 * carry no EXIF, XMP or IPTC, so the photo metadata check passes. Needs
 * Playwright with Chromium.
 */
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const out = (name) => join(root, 'src/assets/showcase', name);
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Playwright not found. Run `npm ci && npx playwright install chromium`, or set PLAYWRIGHT_MODULE.');
  process.exit(1);
}

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.avif': 'image/avif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
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
  { path: '/', file: 'site-home.jpg' },
  { path: '/clients/', file: 'site-clients.jpg' },
  { path: '/about/', file: 'site-about.jpg' },
];

const browser = await chromium.launch();
try {
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(base + s.path, { waitUntil: 'networkidle' });
    // Inter loads with font-display: optional, so the first visit may paint the fallback. Load again from cache.
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const png = await page.screenshot({ type: 'png' });
    await sharp(png).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(out(s.file));
    const m = await sharp(out(s.file)).metadata();
    if (m.exif || m.xmp || m.iptc) throw new Error(`make-shots: ${s.file} has photo metadata`);
    console.log(`Wrote src/assets/showcase/${s.file} (${m.width}x${m.height})`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

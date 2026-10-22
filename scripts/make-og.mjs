/**
 * Renders a 1200x630 share card (the picture LinkedIn, Slack and email show
 * for a link) for each page that would otherwise fall back to the site-wide
 * public/og.png. The cards follow og.png's layout: the page's eyebrow and
 * heading on the left, Nick's round photo on the right, the domain at the
 * bottom. Base.astro and the resume pick up public/og/<path>.jpg (slashes
 * become hyphens) on the next build. Run after changing a page heading:
 *
 *   npm run build && npm run og && npm run build
 *
 * Skipped: the home page (public/og.png is its card and is made by hand),
 * noindex pages, and pages that share their own picture (case studies with a
 * cover screenshot, /food/). Cards for pages that are gone or now skipped are
 * deleted. Needs Playwright with Chromium.
 */
import { readFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const outDir = join(root, 'public/og');
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

// Name and role as the site states them (src/data/site.ts), and the domain it is served from.
const siteTs = readFileSync(join(root, 'src/data/site.ts'), 'utf8');
const field = (key) => {
  const m = siteTs.match(new RegExp(`\\b${key}: '([^']+)'`));
  if (!m) throw new Error(`make-og: no ${key} in src/data/site.ts`);
  return m[1];
};
const name = field('name');
const role = field('role');
const domain = readFileSync(join(root, 'public/CNAME'), 'utf8').trim();

const inter = readFileSync(join(root, 'src/assets/fonts/inter-latin-var.woff2')).toString('base64');
const photo = readFileSync(join(root, 'public/nick-soderstrom.jpg')).toString('base64');

// Built HTML to plain text: tags out (a <br> becomes a space), then entities decoded. A no-break
// space stays one, so "19&nbsp;GoHighLevel" stays together on the card.
const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', ndash: '–', mdash: '—', hellip: '…', times: '×' };
const decode = (html) =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
      e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (named[e.toLowerCase()] ?? m),
    )
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Keep hyphenated words ("100-rep", "fold-to-focus") on one line.
const keepHyphens = (html) => html.replace(/[^\s]+-[^\s]+/g, '<span class="nw">$&</span>');

function pages(dir = dist, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory() && e.name !== '_astro') pages(full, out);
    else if (e.name === 'index.html') out.push('/' + full.slice(dist.length + 1).replace(/index\.html$/, ''));
  }
  return out.sort();
}

function card({ eyebrow, title, byline }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Inter; src: url(data:font/woff2;base64,${inter}) format('woff2'); font-weight: 100 900; }
    * { box-sizing: border-box; margin: 0; }
    html, body { width: 1200px; height: 630px; overflow: hidden; }
    body { position: relative; font-family: Inter, sans-serif; color: #17181a; -webkit-font-smoothing: antialiased;
      background: radial-gradient(600px circle at 100% 0, #eaf0fb, rgb(234 240 251 / 0) 100%), #fbfbf9; }
    .col { position: absolute; left: 84px; width: 690px; top: 92px; bottom: 108px; display: flex; flex-direction: column; justify-content: center; }
    .eyebrow { font-size: 20px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #1f5fd0; white-space: nowrap; margin-bottom: 18px; }
    h1 { font-size: 64px; line-height: 1.08; font-weight: 800; letter-spacing: -0.025em; text-wrap: balance; overflow-wrap: normal; }
    .nw { white-space: nowrap; }
    .byline { margin-top: 24px; font-size: 24px; font-weight: 500; color: #5b5f66; white-space: nowrap; }
    .photo { position: absolute; right: 84px; top: 167px; width: 296px; height: 296px; border-radius: 50%; border: 8px solid #fff;
      object-fit: cover; box-shadow: 0 22px 50px -18px rgb(23 24 26 / 0.35), 0 2px 8px rgb(23 24 26 / 0.06); }
    .domain { position: absolute; left: 84px; bottom: 56px; font-size: 22px; font-weight: 700; color: #8a8f97; }
  </style></head><body>
    <div class="col"><div class="inner">
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      <h1>${keepHyphens(esc(title))}</h1>
      <div class="byline">${esc(byline)}</div>
    </div></div>
    <img class="photo" src="data:image/jpeg;base64,${photo}" alt="">
    <div class="domain">${esc(domain)}</div>
  </body></html>`;
}

// Shrinks the eyebrow and byline to one line, then the heading until the column fits. Never clips:
// a heading that cannot fit at the smallest size fails the run.
function fit() {
  const col = document.querySelector('.col');
  const inner = document.querySelector('.inner');
  const h1 = document.querySelector('h1');
  const oneLine = (el, max, min) => {
    if (!el) return;
    for (let s = max; s >= min; s--) {
      el.style.fontSize = `${s}px`;
      if (el.scrollWidth <= el.clientWidth) return;
    }
    el.style.whiteSpace = 'normal';
  };
  oneLine(document.querySelector('.eyebrow'), 20, 15);
  oneLine(document.querySelector('.byline'), 24, 19);
  const fits = () => inner.offsetHeight <= col.clientHeight && h1.scrollWidth <= h1.clientWidth && inner.scrollWidth <= col.clientWidth;
  for (let s = 64; s >= 34; s--) {
    h1.style.fontSize = `${s}px`;
    if (fits()) return { size: s, lines: Math.round(h1.offsetHeight / (s * 1.08)) };
  }
  return null;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
mkdirSync(outDir, { recursive: true });
const written = new Set();
for (const p of pages()) {
  if (p === '/') continue;
  const html = readFileSync(join(dist, p, 'index.html'), 'utf8');
  if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
  // Only pages on a generated card: '/og.png', or their own card from an earlier run.
  const og = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1];
  const ogPath = og ? new URL(og).pathname : '';
  if (ogPath !== '/og.png' && !ogPath.startsWith('/og/')) continue;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1) throw new Error(`make-og: ${p} has no <h1>`);
  const title = decode(h1[1]);
  // The eyebrow is the last one before the heading; the resume has none and gets its own.
  const eyebrows = [...html.slice(0, h1.index).matchAll(/<(span|p|div)[^>]*class="(?:[^"]*\s)?eyebrow(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/\1>/g)];
  const eyebrow = p === '/resume/' ? 'Resume' : decode(eyebrows.at(-1)?.[2] ?? '');
  // A heading that is already the name (the resume) is not repeated in the byline.
  const byline = title === name ? role : `${name} · ${role}`;
  await page.setContent(card({ eyebrow, title, byline }), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  if (!(await page.evaluate(() => document.fonts.check('800 64px Inter')))) throw new Error('make-og: Inter did not load');
  const fitted = await page.evaluate(fit);
  if (!fitted) throw new Error(`make-og: the heading of ${p} does not fit the card even at 34px: "${title}"`);
  const slug = p.replace(/^\/|\/$/g, '').replace(/\//g, '-');
  const png = await page.screenshot({ type: 'png' });
  // Re-encoded with sharp, which writes no EXIF, XMP or IPTC (the photo metadata check runs on public/).
  await sharp(png).jpeg({ quality: 86, progressive: true, mozjpeg: true }).toFile(join(outDir, `${slug}.jpg`));
  written.add(`${slug}.jpg`);
  console.log(`${p} -> public/og/${slug}.jpg (heading ${fitted.size}px, ${fitted.lines} line${fitted.lines === 1 ? '' : 's'})`);
}
await browser.close();

for (const f of readdirSync(outDir)) {
  if (f.endsWith('.jpg') && !written.has(f)) {
    rmSync(join(outDir, f));
    console.log(`Removed public/og/${f} (no page uses it now)`);
  }
}
for (const f of written) {
  const m = await sharp(join(outDir, f)).metadata();
  if (m.width !== 1200 || m.height !== 630 || m.exif || m.xmp || m.iptc) throw new Error(`make-og: public/og/${f} is not a clean 1200x630 JPEG`);
}
console.log(`Wrote ${written.size} share cards to public/og/. Build again so the pages point at them.`);

/**
 * Renders a 1200x630 share card for every page from the built site: the
 * page's heading and section, with Nick's name and photo, in the site's own
 * font and colours. public/og.png is the default (and home page) card;
 * other pages get public/og/<path>.jpg, which Base.astro picks up on the
 * next build. Run after changing a page heading or the headline stats:
 *
 *   npm run build && npm run og && npm run build
 *
 * Product case studies use their own screenshot instead. Needs Playwright.
 */
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
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

const inter = readFileSync(join(root, 'src/assets/fonts/inter-latin-var.woff2')).toString('base64');
const photo = readFileSync(join(root, 'public/nick-soderstrom.jpg')).toString('base64');
const decode = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Keep hyphenated words ("100-rep") on one line.
const keepHyphens = (html) => html.replace(/\S+-\S+/g, '<span class="nw">$&</span>');

function pages(dir = dist, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory() && e.name !== '_astro') pages(full, out);
    else if (e.name === 'index.html') out.push('/' + full.slice(dist.length + 1).replace(/index\.html$/, ''));
  }
  return out;
}

// The home page card doubles as the site default: the headline and the four stats.
const home = readFileSync(join(dist, 'index.html'), 'utf8');
const stats = [...home.matchAll(/<div[^>]*><dt[^>]*>([^<]*)(?:<span[^>]*>[^<]*<\/span>)?<\/dt><dd[^>]*>([^<]*)<\/dd><\/div>/g)].map((m) => ({ label: decode(m[1]), value: decode(m[2]) }));
// "300+ client contracts", "100% Job Success Score"; a badge with a non-numeric value ("Top 1%") shows its name as-is.
const pills = stats.map(({ label, value }) =>
  /^\d/.test(value) ? `${value} ${label.charAt(0).toLowerCase()}${label.slice(1)}`.replace(/job success score/i, 'Job Success Score') : label,
);
const [homeTitle, homeSub] = decode(home.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<br[^>]*>/, '|')).split('|').map((t) => t.trim());

function card({ eyebrow, title, sub, pills }) {
  // An eyebrow plus pills leaves less room for the heading.
  const dense = Boolean(eyebrow && pills);
  const size = title.length > 70 ? 54 : title.length > 44 || dense ? 62 : 72;
  return `<!doctype html><html><head><style>
    @font-face { font-family: Inter; src: url(data:font/woff2;base64,${inter}) format('woff2'); font-weight: 100 900; }
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; font-family: Inter, sans-serif; color: #17181a; background:
      radial-gradient(700px 420px at 100% 0%, #e7eefc, transparent 70%), #fbfbf9; padding: 64px 72px; display: flex; flex-direction: column; }
    .top { display: flex; align-items: center; gap: 14px; font-weight: 700; font-size: 26px; letter-spacing: -0.01em; }
    .mark { width: 44px; height: 44px; }
    .eyebrow { margin-top: ${dense ? 36 : 56}px; font-size: 22px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #1f5fd0; }
    .nw { white-space: nowrap; }
    h1 { margin-top: 16px; font-size: ${size}px; line-height: 1.08; font-weight: 800; letter-spacing: -0.03em; text-wrap: balance; max-width: 980px; }
    .sub { margin-top: 14px; font-size: 34px; font-weight: 800; letter-spacing: -0.03em; color: #1f5fd0; }
    .pills { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; max-width: 760px; }
    .pill { padding: 10px 18px; border-radius: 999px; background: #e7eefc; color: #17429b; font-size: 21px; font-weight: 700; }
    .foot { margin-top: auto; display: flex; align-items: center; gap: 18px; }
    .foot img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 4px #fff, 0 8px 24px -10px rgb(0 0 0 / .35); }
    .foot strong { display: block; font-size: 26px; }
    .foot span { font-size: 21px; color: #5b5f66; }
    .domain { margin-left: auto; font-size: 22px; font-weight: 600; color: #5b5f66; }
  </style></head><body>
    <div class="top"><svg class="mark" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#17429b"/><path d="M18 46V18h6l16 19V18h6v28h-6L24 27v19z" fill="#fff"/></svg>Nick Soderstrom</div>
    ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
    <h1>${keepHyphens(esc(title))}</h1>
    ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
    ${pills ? `<div class="pills">${pills.map((p) => `<span class="pill">${esc(p)}</span>`).join('')}</div>` : ''}
    <div class="foot"><img src="data:image/jpeg;base64,${photo}" alt=""><div><strong>Nick Soderstrom</strong><span>Senior project manager &amp; operations lead · Chicago</span></div><div class="domain">work-with-nick.com</div></div>
  </body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
mkdirSync(join(root, 'public/og'), { recursive: true });
let n = 0;
for (const p of pages()) {
  if (p === '/thanks/') continue;
  const html = readFileSync(join(dist, p, 'index.html'), 'utf8');
  // Pages that already share their own picture (product case-study screenshots) need no card.
  if (/<meta property="og:image" content="[^"]*\/_astro\//.test(html)) continue;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1) continue;
  const before = html.slice(0, h1.index);
  const eyebrow = decode([...before.matchAll(/<span class="eyebrow[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].pop()?.[1] ?? '');
  let spec;
  if (p === '/') spec = { title: homeTitle, sub: homeSub, pills };
  // The resume's heading is just the name, which the card already shows twice.
  else if (p === '/resume/') spec = { eyebrow: 'Resume', title: homeTitle, pills };
  else spec = { eyebrow, title: decode(h1[1]) };
  await page.setContent(card(spec), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const file = p === '/' ? join(root, 'public/og.png') : join(root, 'public/og', `${p.replace(/^\/|\/$/g, '').replace(/\//g, '-')}.jpg`);
  await page.screenshot(p === '/' ? { path: file } : { path: file, type: 'jpeg', quality: 88 });
  n++;
}
await browser.close();
console.log(`Wrote ${n} share cards (public/og.png and public/og/*.jpg).`);

/**
 * Full QA + SEO audit for yetour.info against the built site in ./dist.
 *
 *   npm run build && npm run qa
 *
 * Every page is checked at four viewports — 320px, phone, tablet, desktop —
 * plus landscape, for JS errors, horizontal overflow, heading outline, image
 * alt text, duplicate ids, broken links and anchors, tap targets and tiny text
 * on phones, and text contrast against whatever is actually painted behind it.
 * SEO: title and description length and uniqueness, canonical, robots, Open
 * Graph, JSON-LD validity and required nodes, sitemap coverage, outbound link
 * hygiene. Then it drives the interactive surfaces: date filters, the
 * countdown, the discography player and its theme swap, deep links, the video
 * facades and the full prev/next chain across all twenty dates.
 *
 * Needs Playwright with Chromium. Set PLAYWRIGHT_EXECUTABLE_PATH if Chromium
 * lives somewhere Playwright does not expect, or PLAYWRIGHT_MODULE to point at
 * an existing install.
 */
import http from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Playwright not found. Install it or set PLAYWRIGHT_MODULE.');
  process.exit(1);
}
const launchOpts = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  : {};

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.statusCode = 404; return createReadStream(join(dist, '404.html')).pipe(res); }
  res.setHeader('content-type', types[extname(p)] || 'application/octet-stream');
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name === 'index.html') out.push('/' + full.slice(dist.length).replace(/index\.html$/, ''));
  }
  return out;
}
const pages = walk(dist).sort().filter((p) => p !== '/404/');
const findings = [];
const seenLinks = new Set();

/* ----------------------------------------------------------- static / SEO */

const sitemap = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
const titles = new Map();
const descs = new Map();

for (const p of pages) {
  const html = readFileSync(join(dist, p, 'index.html'), 'utf8');
  const pick = (re) => (html.match(re) || [])[1] || '';
  const title = pick(/<title>([^<]*)<\/title>/);
  const desc = pick(/<meta name="description" content="([^"]*)"/);
  const canonical = pick(/<link rel="canonical" href="([^"]*)"/);
  const robots = pick(/<meta name="robots" content="([^"]*)"/);

  if (!title) findings.push(`${p}: missing <title>`);
  else if (title.length > 65) findings.push(`${p}: title ${title.length} chars (>65): "${title}"`);
  if (titles.has(title)) findings.push(`${p}: duplicate <title> with ${titles.get(title)}`);
  titles.set(title, p);

  if (!desc) findings.push(`${p}: missing meta description`);
  else if (desc.length < 50 || desc.length > 165) findings.push(`${p}: description ${desc.length} chars (want 50–165)`);
  if (descs.has(desc)) findings.push(`${p}: duplicate meta description with ${descs.get(desc)}`);
  descs.set(desc, p);

  if (!canonical) findings.push(`${p}: missing canonical`);
  else if (!canonical.endsWith(p)) findings.push(`${p}: canonical ${canonical} does not match path`);
  if (!robots) findings.push(`${p}: missing robots meta`);
  if (/noindex/.test(robots)) findings.push(`${p}: unexpectedly noindex`);
  if (canonical && !sitemap.includes(`<loc>${canonical}</loc>`)) findings.push(`${p}: not in sitemap`);
  if (!/<meta property="og:image"/.test(html)) findings.push(`${p}: missing og:image`);
  if (!/<meta name="twitter:card"/.test(html)) findings.push(`${p}: missing twitter:card`);

  const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  if (!ld.length) findings.push(`${p}: no JSON-LD`);
  for (const m of ld) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch (e) { findings.push(`${p}: invalid JSON-LD (${e.message})`); continue; }
    const kinds = (parsed['@graph'] || []).map((n) => n['@type']);
    for (const need of ['WebSite', 'WebPage', 'BreadcrumbList']) {
      if (!kinds.includes(need)) findings.push(`${p}: JSON-LD missing ${need}`);
    }
  }

  for (const m of html.matchAll(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)) {
    if (m[1].startsWith('http://')) findings.push(`${p}: insecure outbound link ${m[1]}`);
    if (!/rel="[^"]*(noopener|nofollow)/.test(m[0])) findings.push(`${p}: outbound link without rel: ${m[1].slice(0, 60)}`);
  }
  for (const m of html.matchAll(/<iframe[^>]*>/g)) {
    if (!/title="/.test(m[0])) findings.push(`${p}: iframe without title`);
  }
}

for (const asset of ['/robots.txt', '/sitemap-index.xml', '/og.png', '/favicon.svg']) {
  if (!existsSync(join(dist, asset))) findings.push(`asset missing: ${asset}`);
}
if (!existsSync(join(dist, '404.html'))) findings.push('asset missing: /404.html');

/* --------------------------------------------------------- browser sweeps */

const browser = await chromium.launch(launchOpts);
const viewports = [
  ['narrow', 320, 720],
  ['phone', 390, 844],
  ['landscape', 844, 420],
  ['tablet', 768, 1024],
  ['desktop', 1440, 900],
];

for (const [name, width, height] of viewports) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 500, colorScheme: name === 'tablet' ? 'light' : 'dark' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    // Offline-sandbox resource noise, and the 404 probe's own 404, are not findings.
    if (m.type() === 'error' && !/CERT|fonts\.g|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|ERR_TUNNEL|ERR_PROXY|ERR_CONNECTION|status of 404/.test(m.text())) {
      errs.push('console: ' + m.text());
    }
  });

  for (const p of [...pages, '/no-such-page/']) {
    errs.length = 0;
    const resp = await page.goto(base + p, { waitUntil: 'load' });
    const want = p === '/no-such-page/' ? 404 : 200;
    if (!resp || resp.status() !== want) { findings.push(`${name} ${p}: HTTP ${resp && resp.status()} (want ${want})`); continue; }

    const r = await page.evaluate(({ width }) => {
      const out = [];
      const w = document.documentElement.clientWidth;

      if (document.documentElement.scrollWidth > w + 1) {
        const bad = [...document.querySelectorAll('body *')]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            if (!(b.right > w + 1 && b.width > 0)) return false;
            for (let n = el; n; n = n.parentElement) {
              if (n instanceof HTMLElement && getComputedStyle(n).overflowX === 'auto') return false;
            }
            return true;
          })
          .slice(0, 3)
          .map((el) => `${el.tagName}.${el.getAttribute('class') || ''}"${(el.textContent || '').trim().slice(0, 24)}"`);
        if (bad.length) out.push(`overflow ${document.documentElement.scrollWidth}>${w}: ${bad.join(' | ')}`);
      }

      const h1 = document.querySelectorAll('h1').length;
      if (h1 !== 1) out.push(`h1 count ${h1}`);
      const heads = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => +h.tagName[1]);
      for (let i = 1; i < heads.length; i++) {
        if (heads[i] - heads[i - 1] > 1) { out.push(`heading skip h${heads[i - 1]}→h${heads[i]}`); break; }
      }

      document.querySelectorAll('img').forEach((img) => {
        if (!img.hasAttribute('alt')) out.push('img missing alt: ' + img.getAttribute('src'));
      });
      document.querySelectorAll('svg[role="img"]').forEach((svg) => {
        if (!svg.getAttribute('aria-label') && !svg.querySelector('title')) out.push('svg[role=img] without a name');
      });

      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (dup.length) out.push('duplicate ids: ' + [...new Set(dup)].join(','));

      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        const id = a.getAttribute('href').slice(1);
        if (id && !document.getElementById(id)) out.push('broken anchor #' + id);
      });

      document.querySelectorAll('a').forEach((a) => {
        if (!(a.textContent || '').trim() && !a.getAttribute('aria-label')) out.push('link without accessible text: ' + a.getAttribute('href'));
      });

      if (width <= 390) {
        const small = [];
        document.querySelectorAll('a, button').forEach((el) => {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) return;
          if (el.closest('.skip-ye, .tnav-links, .tfoot, .song, .srcs, p')) return;
          if (b.height < 30) small.push(`${el.tagName}:${(el.textContent || '').trim().slice(0, 18)} ${Math.round(b.height)}px`);
        });
        if (small.length) out.push('tap target <30px: ' + small.slice(0, 5).join(' | '));

        const tiny = [...document.querySelectorAll('body *')].filter(
          (el) => !el.children.length && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 11 && getComputedStyle(el).visibility !== 'hidden',
        );
        if (tiny.length) out.push('text < 11px: ' + tiny.slice(0, 4).map((el) => el.tagName + ' ' + getComputedStyle(el).fontSize).join(' | '));
      }

      // Contrast against whatever opaque background is actually behind the text.
      // rgb() gives 0–255; color-mix() computes to color(srgb …) with 0–1 floats.
      const parse = (c) => {
        const n = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        return c.startsWith('color(') ? n.map((v) => v * 255) : n;
      };
      const srgb = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const lum = ([r, g, b]) => 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
      const behind = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor;
          const a = (bg.match(/[\d.]+/g) || [])[3];
          if (bg && bg !== 'transparent' && a !== '0') return parse(bg);
        }
        return [8, 9, 10];
      };
      const low = new Set();
      for (const el of document.querySelectorAll('p, li, dd, dt, span, a, h1, h2, h3, h4, strong, em, td, th, figcaption, blockquote, button')) {
        if (el.children.length || !el.textContent.trim()) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden]')) continue;
        const size = parseFloat(cs.fontSize);
        const bold = parseInt(cs.fontWeight, 10) >= 700;
        const large = size >= 24 || (size >= 18.66 && bold);
        const fg = parse(cs.color);
        const bg = behind(el);
        if (fg.length < 3 || bg.length < 3) continue;
        const l1 = lum(fg);
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < (large ? 3 : 4.5)) low.add(`${el.tagName}.${el.getAttribute('class') || ''} ${ratio.toFixed(2)}:1 @${size}px`);
      }
      if (low.size) out.push('low contrast: ' + [...low].slice(0, 5).join(' | '));

      return out;
    }, { width });

    for (const f of r) findings.push(`${name} ${p}: ${f}`);
    for (const e of errs) findings.push(`${name} ${p}: ${e}`);
    (await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))).forEach((l) => seenLinks.add(l));
  }
  await ctx.close();
}

for (const l of seenLinks) {
  const [path0, hash] = l.split('#');
  const path = path0.split('?')[0];
  const file = path.endsWith('/') ? join(dist, path, 'index.html') : join(dist, path);
  if (!existsSync(file)) { findings.push(`broken internal link: ${l}`); continue; }
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) findings.push(`internal link without trailing slash: ${l}`);
  if (hash && !readFileSync(file, 'utf8').includes(`id="${hash}"`)) findings.push(`broken cross-page anchor: ${l}`);
}

/* ------------------------------------------------------------ interaction */

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => findings.push('interaction: pageerror ' + e.message));

await page.goto(base + '/', { waitUntil: 'load' });
const shown = () => page.evaluate(() => [...document.querySelectorAll('[data-show]')].filter((e) => !e.hidden).length);
const total = await page.evaluate(() => document.querySelectorAll('[data-show]').length);
await page.tap('[data-filter="status"][data-value="upcoming"]');
const up = await shown();
if (up === 0 || up === total) findings.push(`filters: upcoming shows ${up} of ${total}`);
await page.tap('[data-filter="continent"][data-value="Asia"]');
if ((await shown()) === 0) findings.push('filters: upcoming + Asia matched nothing (expected Jakarta)');
await page.tap('[data-filter="status"][data-value="cancelled"]');
if ((await shown()) !== 0) findings.push('filters: cancelled + Asia should match nothing');
if (!(await page.evaluate(() => !document.querySelector('[data-empty]').hidden))) findings.push('filters: empty state did not appear');
await page.tap('[data-filter="status"][data-value="all"]');
await page.tap('[data-filter="continent"][data-value="all"]');
if ((await shown()) !== total) findings.push('filters: reset did not restore every date');

const cd = await page.evaluate(() => [...document.querySelectorAll('[data-cd]')].map((e) => e.textContent));
if (cd.length !== 4 || cd.some((v) => !/^\d{2,}$/.test(v || ''))) findings.push('countdown: not populated — ' + cd.join('/'));

await page.goto(base + '/discography/', { waitUntil: 'load' });
const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ye-accent').trim());
await page.tap('.sq[data-record="yeezus"]');
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({
  accent: getComputedStyle(document.documentElement).getPropertyValue('--ye-accent').trim(),
  pressed: [...document.querySelectorAll('.sq[aria-pressed="true"]')].map((e) => e.dataset.record).join(),
  meta: [...document.querySelectorAll('[data-pmeta]')].filter((e) => !e.hidden).map((e) => e.dataset.pmeta).join(),
  note: [...document.querySelectorAll('[data-pnote]')].filter((e) => !e.hidden).map((e) => e.dataset.pnote).join(),
  hash: location.hash,
}));
if (after.accent === before) findings.push('discography: theme accent did not change on select');
if (after.pressed !== 'yeezus') findings.push('discography: aria-pressed is ' + after.pressed);
if (after.meta !== 'yeezus') findings.push('discography: player meta is ' + after.meta);
if (after.note !== 'yeezus') findings.push('discography: detail panel is ' + after.note);
if (after.hash !== '#yeezus') findings.push('discography: hash is ' + after.hash);

const pad = await page.evaluate(() => ({
  pad: parseFloat(getComputedStyle(document.body).paddingBottom),
  h: document.querySelector('[data-player]').offsetHeight,
}));
if (!(pad.pad >= pad.h)) findings.push(`discography: body padding ${pad.pad}px < fixed player ${pad.h}px`);

await page.goto(base + '/about/', { waitUntil: 'load' }); // a hash-only goto would not reload
await page.goto(base + '/discography/#808s-and-heartbreak', { waitUntil: 'load' });
await page.waitForTimeout(400);
if ((await page.evaluate(() => [...document.querySelectorAll('.sq[aria-pressed="true"]')].map((e) => e.dataset.record).join())) !== '808s-and-heartbreak') {
  findings.push('discography: deep link did not select the record');
}

await page.goto(base + '/globe/', { waitUntil: 'load' });
if ((await page.evaluate(() => document.querySelectorAll('iframe').length)) !== 0) {
  findings.push('globe: a video iframe loaded before any click');
}
await page.tap('[data-video]');
await page.waitForTimeout(250);
const frames = await page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src') || ''));
if (frames.length !== 1 || !frames[0].includes('youtube-nocookie.com/embed/')) {
  findings.push('globe: facade did not swap in the embed — ' + frames.join());
}

await page.goto(base + '/shows/inglewood-2026-04-01/', { waitUntil: 'load' });
for (let i = 0; i < 19; i++) {
  const next = await page.evaluate(() => document.querySelector('.pager .next')?.getAttribute('href'));
  if (!next || !next.startsWith('/shows/')) { findings.push(`pager: chain broke after ${i} hops at ${page.url()}`); break; }
  await page.goto(base + next, { waitUntil: 'load' });
}
if (!page.url().endsWith('/shows/glendale-2026-11-21/')) {
  findings.push('pager: 19 hops from the opener did not reach the finale — ' + page.url());
}

await ctx.close();
await browser.close();
server.close();

const summary = `QA: ${pages.length} pages × ${viewports.length} viewports, ${seenLinks.size} internal links, SEO audit, contrast, and 10 interaction checks.`;
if (findings.length) {
  console.log('FINDINGS:\n' + findings.join('\n') + '\n' + summary);
  process.exit(1);
}
console.log('QA clean. ' + summary);

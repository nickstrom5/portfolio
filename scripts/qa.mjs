/**
 * Site QA + SEO audit against the built site in ./dist.
 *
 *   npm run build && npm run qa
 *
 * Checks every page at phone, tablet and desktop widths in light and dark:
 * JS errors, horizontal overflow, heading outline, alt text, labels, tap
 * targets and tiny text on phones, internal links and anchors, plus SEO:
 * title length, description length, canonical, robots, Open Graph image,
 * JSON-LD validity and sitemap coverage. Exercises the menu, theme toggle,
 * work filters, Apps tiles, contact form and key assets.
 *
 * Exits 1 with a findings list if anything fails. Needs Playwright with
 * Chromium (`npm i -D playwright && npx playwright install chromium`) or
 * PLAYWRIGHT_MODULE pointing at an existing install.
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

// Static server for dist (mirrors GitHub Pages: /x/ -> /x/index.html).
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.statusCode = 404; return createReadStream(join(dist, '404.html')).pipe(res); }
  res.setHeader('content-type', types[extname(p)] || 'application/octet-stream');
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// Discover pages from dist.
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name === 'index.html') out.push('/' + full.slice(dist.length).replace(/index\.html$/, ''));
  }
  return out;
}
const pages = walk(dist).sort();
const noindexAllowed = new Set(['/thanks/', '/resume/']);
const findings = [];
const seenLinks = new Set();
const viewports = [['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1280, 900]];
const browser = await chromium.launch();

// SEO checks from the HTML (fast, no browser).
const sitemap = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
for (const p of pages) {
  const html = readFileSync(join(dist, p, 'index.html'), 'utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
  const robots = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
  const noindex = /noindex/.test(robots);
  if (!title) findings.push(`${p}: missing <title>`);
  if (title.length > 65 && !noindex) findings.push(`${p}: title ${title.length} chars (>65): "${title}"`);
  if (!desc) findings.push(`${p}: missing meta description`);
  else if (!noindex && (desc.length < 50 || desc.length > 165)) findings.push(`${p}: description ${desc.length} chars (want 50–165)`);
  if (!canonical) findings.push(`${p}: missing canonical`);
  else if (!canonical.endsWith(p)) findings.push(`${p}: canonical ${canonical} does not match path`);
  if (!robots) findings.push(`${p}: missing robots meta`);
  if (noindex && !noindexAllowed.has(p)) findings.push(`${p}: unexpectedly noindex`);
  if (!noindex && !sitemap.includes(`<loc>${canonical}</loc>`)) findings.push(`${p}: indexable but not in sitemap`);
  if (noindex && sitemap.includes(`<loc>${canonical}</loc>`)) findings.push(`${p}: noindex but listed in sitemap`);
  if (!noindex && !/<meta property="og:image"/.test(html)) findings.push(`${p}: missing og:image`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try { JSON.parse(m[1]); } catch (e) { findings.push(`${p}: invalid JSON-LD (${e.message})`); }
  }
  if (!noindex && !/"@id":"[^"]*\/#person"/.test(html)) findings.push(`${p}: indexable page without Person JSON-LD`);
}
for (const asset of ['/robots.txt', '/sitemap-index.xml', '/og.png', '/favicon.svg', '/favicon-96x96.png', '/apple-touch-icon.png', '/nick-soderstrom.jpg', '/Nick-Soderstrom-Resume.pdf', '/CNAME']) {
  if (!existsSync(join(dist, asset))) findings.push(`asset missing: ${asset}`);
}

// Browser checks.
for (const [vpName, width, height] of viewports) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, hasTouch: vpName === 'phone' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/CERT|fonts\.g|ERR_NAME_NOT_RESOLVED|ERR_INTERNET/.test(m.text())) errs.push('console: ' + m.text()); });
    for (const p of pages) {
      errs.length = 0;
      const resp = await page.goto(base + p, { waitUntil: 'load' });
      if (!resp || resp.status() !== 200) { findings.push(`${vpName}/${scheme} ${p}: HTTP ${resp && resp.status()}`); continue; }
      const r = await page.evaluate(({ vpName }) => {
        const out = [];
        const w = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth > w) {
          const bad = [...document.querySelectorAll('body *')].filter((el) => { const b = el.getBoundingClientRect(); return b.right > w + 1 && b.width > 0; }).slice(0, 3).map((el) => el.tagName + '.' + el.className);
          out.push('horizontal overflow: ' + bad.join(', '));
        }
        const h1 = document.querySelectorAll('h1').length; if (h1 !== 1) out.push(`h1 count ${h1}`);
        const heads = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => +h.tagName[1]);
        for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i - 1] > 1) { out.push(`heading skip h${heads[i - 1]}→h${heads[i]}`); break; }
        document.querySelectorAll('img').forEach((img) => { if (!img.hasAttribute('alt')) out.push('img missing alt: ' + img.getAttribute('src')); });
        const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); const dup = ids.filter((id, i) => ids.indexOf(id) !== i); if (dup.length) out.push('duplicate ids: ' + [...new Set(dup)].join(','));
        document.querySelectorAll('a[href^="#"]').forEach((a) => { const id = a.getAttribute('href').slice(1); if (id && !document.getElementById(id)) out.push('broken anchor #' + id); });
        document.querySelectorAll('input:not([type=hidden]):not(.honeypot), select, textarea').forEach((el) => { const labelled = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.getAttribute('aria-label'); if (!labelled) out.push('unlabelled field: ' + el.name); });
        if (vpName === 'phone' && location.pathname !== '/resume/') {
          const small = [];
          document.querySelectorAll('a, button').forEach((el) => { const b = el.getBoundingClientRect(); if (b.width === 0 || b.height === 0) return; if (el.closest('.skip')) return; if (el.tagName === 'A' && getComputedStyle(el, '::after').position === 'absolute') return; /* stretched link: the whole card is the target */ if (b.height < 32 && !el.closest('nav, footer, .tags, .foot, .links, .c-meta, .edu, .more, .what, .roles, figcaption, .caption, .note, p')) small.push(`${el.tagName}:${(el.textContent || '').trim().slice(0, 20)} ${Math.round(b.width)}x${Math.round(b.height)}`); });
          if (small.length) out.push('small tap targets: ' + small.slice(0, 6).join(' | '));
          const tiny = [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 11 && getComputedStyle(el).visibility !== 'hidden');
          if (tiny.length) out.push('text < 11px: ' + tiny.slice(0, 4).map((el) => el.tagName + '.' + el.className + ' ' + getComputedStyle(el).fontSize).join(' | '));
        }
        return out;
      }, { vpName });
      for (const f of r) findings.push(`${vpName}/${scheme} ${p}: ${f}`);
      for (const e of errs) findings.push(`${vpName}/${scheme} ${p}: ${e}`);
      (await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))).forEach((l) => seenLinks.add(l));
    }
    await ctx.close();
  }
}
for (const l of seenLinks) {
  const [path0, hash] = l.split('#');
  const path = path0.split('?')[0];
  const file = path.endsWith('/') ? join(dist, path, 'index.html') : join(dist, path);
  if (!existsSync(file)) { findings.push(`broken internal link: ${l}`); continue; }
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) findings.push(`internal link without trailing slash: ${l}`);
  if (hash && !readFileSync(file, 'utf8').includes(`id="${hash}"`)) findings.push(`broken cross-page anchor: ${l}`);
}

// Interactions on a phone.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => findings.push('phone interaction error: ' + e.message));
await page.goto(base + '/', { waitUntil: 'load' });
await page.tap('[data-menu-toggle]');
if (!(await page.evaluate(() => getComputedStyle(document.getElementById('site-menu')).display !== 'none'))) findings.push('phone: menu does not open');
await page.tap('[data-theme-toggle]');
if (!(await page.evaluate(() => document.documentElement.dataset.theme))) findings.push('phone: theme toggle did nothing');
await page.goto(base + '/work/', { waitUntil: 'load' });
if (await page.$('[data-filter="mobile"]')) {
  await page.tap('[data-filter="mobile"]');
  const visible = await page.evaluate(() => [...document.querySelectorAll('[data-project-grid] > [data-category]')].filter((e) => !e.hidden).map((e) => e.dataset.category));
  if (visible.some((c) => c !== 'mobile') || visible.length === 0) findings.push('work filter broken: ' + visible.join(','));
}
await page.goto(base + '/apps/', { waitUntil: 'load' });
await page.tap('[data-project="clam"]');
await page.waitForTimeout(400);
if (!(await page.evaluate(() => !document.getElementById('clam').hidden && document.getElementById('goodwalk').hidden && location.hash === '#clam'))) findings.push('apps tiles: switching to Clam failed');
await page.goto(base + '/apps/#site', { waitUntil: 'load' });
if (!(await page.evaluate(() => !document.getElementById('site').hidden))) findings.push('apps deep link #site failed');
await page.goto(base + '/contact/', { waitUntil: 'load' });
const form = await page.evaluate(() => ({ action: document.querySelector('form').action, fields: [...document.querySelectorAll('form [name]')].map((e) => e.name) }));
if (!/formspree|mailto:/.test(form.action)) findings.push('contact form action unexpected: ' + form.action);
for (const f of ['name', 'email', 'type', 'budget', 'message', '_gotcha']) if (!form.fields.includes(f)) findings.push('form missing field ' + f);
await ctx.close();
await browser.close();
server.close();

const summary = `QA: ${pages.length} pages × ${viewports.length * 2} contexts, ${seenLinks.size} internal links, SEO audit on every page.`;
if (findings.length) {
  console.log('FINDINGS:\n' + findings.join('\n') + '\n' + summary);
  process.exit(1);
}
console.log('QA clean. ' + summary);

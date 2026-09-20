import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const dist = new URL('./dist/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.statusCode = 404; return createReadStream(join(dist, '404.html')).pipe(res); }
  res.setHeader('content-type', types[extname(p)] || 'application/octet-stream');
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await p.goto(base + '/', { waitUntil: 'load' });
console.log('--- skip link + nav cta colours ---');
console.log(JSON.stringify(await p.evaluate(() => {
  const out = {};
  for (const sel of ['.skip-ye', '.tnav-cta', '.tnav-cta span[aria-hidden]', '.sr-only-ye', '.box-go']) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = 'MISSING'; continue; }
    const cs = getComputedStyle(el);
    let bg = 'none', node = el;
    while (node) { const b = getComputedStyle(node).backgroundColor; const a = (b.match(/[\d.]+/g) || [])[3]; if (b && b !== 'transparent' && a !== '0') { bg = b + ' <- ' + node.tagName + '.' + node.className; break; } node = node.parentElement; }
    out[sel] = { color: cs.color, ownBg: cs.backgroundColor, resolvedBg: bg };
  }
  out.rootVars = ['--ye-bone', '--ye-void', '--ye-dust', '--ye-slab', '--ye-pit'].map((v) => v + '=' + getComputedStyle(document.documentElement).getPropertyValue(v).trim());
  return out;
}, null), null, 1));

console.log('--- discography deep link ---');
await p.goto(base + '/discography/#808s-and-heartbreak', { waitUntil: 'load' });
await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => ({
  hash: location.hash,
  pressed: [...document.querySelectorAll('.sq[aria-pressed="true"]')].map((e) => e.dataset.record),
  recordsSeen: [...document.querySelectorAll('.sq[data-record]')].length,
  hasTarget: !!document.querySelector('.sq[data-record="808s-and-heartbreak"]'),
}))));
await b.close(); server.close();

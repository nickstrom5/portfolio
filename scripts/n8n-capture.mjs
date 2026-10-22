/**
 * Proves the /n8n/ exports against a real n8n and refreshes the screenshots.
 *
 *   N8N_URL=http://localhost:5678 N8N_EMAIL=… N8N_PASSWORD=… npm run n8n:capture
 *
 * Needs a local n8n you own (for example `npx n8n` with a throwaway owner
 * account) and Playwright (or PLAYWRIGHT_MODULE). For every workflow it:
 *   1. builds the JSON the page serves (src/lib/n8n/export.ts),
 *   2. checks every node against that n8n's own node definitions: the type
 *      and version exist, every parameter is one the node has and is shown
 *      for those settings, option values are real, the credential type fits,
 *   3. imports it, with placeholder credentials so the canvas shows no
 *      "credential missing" warnings (it deletes the instance's workflows
 *      first, so use an instance with nothing else in it),
 *   4. opens it in the editor, zooms to fit and saves a crop of the canvas
 *      to src/assets/n8n/<case>-<workflow>.png.
 * Exits 1 if any check fails. Nothing is sent anywhere but N8N_URL.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

const BASE = (process.env.N8N_URL || 'http://localhost:5678').replace(/\/$/, '');
const { N8N_EMAIL: email, N8N_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error('Set N8N_EMAIL and N8N_PASSWORD for an owner account on the local n8n.');
  process.exit(1);
}
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Playwright not found. Install it or set PLAYWRIGHT_MODULE.');
  process.exit(1);
}

const out = await build({
  stdin: { contents: "export { cases } from './src/data/n8n/index.ts'; export { specs } from './src/data/n8n/specs.ts'; export { toN8nJson } from './src/lib/n8n/export.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { cases, specs, toN8nJson } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

// Log in and keep the auth cookie.
const login = await fetch(`${BASE}/rest/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emailOrLdapLoginId: email, password }) });
if (!login.ok) {
  console.error(`Login failed: ${login.status}`);
  process.exit(1);
}
const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const auth = cookie.match(/n8n-auth=([^;]+)/)?.[1];
const api = async (method, path, body) => {
  const r = await fetch(BASE + '/rest' + path, { method, headers: { 'content-type': 'application/json', cookie, 'browser-id': 'n8n-capture' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} ${r.status}: ${t.slice(0, 300)}`);
  return JSON.parse(t).data;
};

/* ---------- 1 and 2: build and check against the instance's node definitions ---------- */

const descs = await (await fetch(`${BASE}/types/nodes.json`, { headers: { cookie } })).json();
const problems = [];
function shown(p, params, ver, props) {
  const d = p.displayOptions;
  if (!d) return true;
  const val = (k) => {
    if (k === '@version') return ver;
    const key = k.replace(/^\//, '');
    return params[key] !== undefined ? params[key] : props.find((q) => q.name === key)?.default;
  };
  const test = (want, have) =>
    [].concat(want).some((w) => {
      if (w && typeof w === 'object' && '_cnd' in w) {
        const c = w._cnd;
        if ('gte' in c) return have >= c.gte;
        if ('lte' in c) return have <= c.lte;
        if ('gt' in c) return have > c.gt;
        if ('lt' in c) return have < c.lt;
        if ('eq' in c) return have === c.eq;
        if ('not' in c) return have !== c.not;
        return true;
      }
      return w === have;
    });
  for (const [k, want] of Object.entries(d.show ?? {})) if (!test(want, val(k))) return false;
  for (const [k, want] of Object.entries(d.hide ?? {})) if (test(want, val(k))) return false;
  return true;
}
function checkValue(where, p, v, sink) {
  if (p.type === 'options' && typeof v === 'string' && !v.startsWith('=') && p.options && !p.typeOptions?.loadOptionsMethod && !p.typeOptions?.loadOptions) {
    if (!p.options.some((o) => o.value === v)) sink.push(`${where}: "${v}" is not an option`);
  }
  if (p.type === 'collection' && v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      const sub = (p.options ?? []).find((o) => o.name === k);
      if (!sub) sink.push(`${where}.${k}: not in this collection`);
      else checkValue(`${where}.${k}`, sub, v[k], sink);
    }
  }
  if (p.type === 'fixedCollection' && v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      const grp = (p.options ?? []).find((o) => o.name === k);
      if (!grp) {
        sink.push(`${where}.${k}: not a group`);
        continue;
      }
      for (const row of [].concat(v[k])) for (const rk of Object.keys(row ?? {})) {
        const f = grp.values.find((x) => x.name === rk);
        if (!f) sink.push(`${where}.${k}.${rk}: not a field`);
        else checkValue(`${where}.${k}.${rk}`, f, row[rk], sink);
      }
    }
  }
}
const files = [];
for (const c of cases) for (const a of c.automations) {
  const file = `${c.business.id}-${a.id}`;
  const wf = toN8nJson(a, specs[c.business.id][a.id], c.business.id);
  files.push({ file, wf });
  for (const n of wf.nodes) {
    const d = descs.find((x) => x.name === n.type && [].concat(x.version).includes(n.typeVersion));
    const where = `${file} › ${n.name}`;
    if (!d) {
      problems.push(`${where}: this n8n has no ${n.type} version ${n.typeVersion}`);
      continue;
    }
    for (const [k, v] of Object.entries(n.parameters)) {
      const vis = d.properties.filter((p) => p.name === k && shown(p, n.parameters, n.typeVersion, d.properties));
      if (!vis.length) {
        problems.push(`${where}: parameter ${k} is unknown or hidden for these settings`);
        continue;
      }
      const tries = vis.map((p) => {
        const sink = [];
        checkValue(`${where}.${k}`, p, v, sink);
        return sink;
      });
      if (tries.every((t) => t.length)) problems.push(...tries[0]);
    }
    for (const ck of Object.keys(n.credentials ?? {})) if (!(d.credentials ?? []).some((x) => x.name === ck)) problems.push(`${where}: credential type ${ck} does not fit this node`);
  }
}
if (problems.length) {
  console.log('n8n capture FAILED, exports do not match this n8n:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`${files.length} workflows checked against ${descs.length} node definitions.`);

/* ---------- 3: import ---------- */

for (const w of await api('GET', '/workflows')) {
  await api('POST', `/workflows/${w.id}/archive`).catch(() => {});
  await api('DELETE', `/workflows/${w.id}`).catch(() => {});
}
const creds = new Map((await api('GET', '/credentials')).map((x) => [`${x.type}|${x.name}`, x.id]));
const fake = { accessToken: 'placeholder', apiKey: 'placeholder', appToken: 'placeholder', name: 'X-Placeholder', value: 'placeholder', shopSubdomain: 'placeholder', clientId: 'placeholder', clientSecret: 'placeholder', oauthTokenData: { access_token: 'placeholder' } };
const ids = {};
// Error workflows and sub-workflows first, so the workflows that point at them can.
const rank = (f) => (f.wf.nodes.some((n) => n.type === 'n8n-nodes-base.errorTrigger') ? 0 : f.wf.nodes.some((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger') ? 1 : 2);
for (const { file, wf } of [...files].sort((x, y) => rank(x) - rank(y))) {
  for (const n of wf.nodes) for (const [type, c] of Object.entries(n.credentials ?? {})) {
    const key = `${type}|${c.name}`;
    if (!creds.has(key)) creds.set(key, (await api('POST', '/credentials', { name: c.name, type, data: fake })).id);
    n.credentials[type] = { id: creds.get(key), name: c.name };
  }
  if (wf.settings.errorWorkflow) wf.settings.errorWorkflow = ids[wf.settings.errorWorkflow];
  for (const n of wf.nodes) if (n.type === 'n8n-nodes-base.executeWorkflow' && ids[n.parameters.workflowId?.value]) n.parameters.workflowId.value = ids[n.parameters.workflowId.value];
  const { tags, meta, pinData, ...body } = wf;
  ids[file] = (await api('POST', '/workflows', body)).id;
}
console.log(`Imported ${files.length} workflows.`);

/* ---------- 4: screenshots ---------- */

mkdirSync('src/assets/n8n', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
await ctx.addCookies([{ name: 'n8n-auth', value: auth, url: BASE }]);
const page = await ctx.newPage();
for (const { file, wf } of files) {
  await page.goto(`${BASE}/workflow/${ids[file]}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-test-id="canvas-node"]', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press('Shift+1').catch(() => {});
  await page.locator('[data-test-id="zoom-to-fit"]').click().catch(() => {});
  await page.waitForTimeout(800);
  const shownNodes = await page.locator('[data-test-id="canvas-node"]').count();
  const expected = wf.nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote').length;
  if (shownNodes !== expected) problems.push(`${file}: the editor shows ${shownNodes} nodes, the export has ${expected}`);
  // Crop to the nodes and the sticky note, so n8n's toolbars stay out of the picture.
  const box = await page.$$eval('.vue-flow__node', (ns) => {
    const r = ns.map((n) => n.getBoundingClientRect()).filter((b) => b.width > 0);
    return { x: Math.min(...r.map((b) => b.left)), y: Math.min(...r.map((b) => b.top)), r: Math.max(...r.map((b) => b.right)), b: Math.max(...r.map((b) => b.bottom)) };
  });
  const x = Math.max(0, box.x - 36);
  const y = Math.max(0, box.y - 36);
  await page.screenshot({ path: `src/assets/n8n/${file}.png`, clip: { x, y, width: Math.min(1600, box.r + 76) - x, height: Math.min(900, box.b + 60) - y } });
  console.log(`  ${file}: ${shownNodes} nodes`);
}
await browser.close();
if (problems.length) {
  console.log('n8n capture FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('n8n capture clean: every workflow validated, imported and captured.');

/**
 * Writes the concept sites into public/demos/<site>/ as plain HTML.
 *
 *   npm run demos
 *
 * Each site module exports { slug, pages, layout }. The CSS for each site and the
 * shared public/demos/site.js are hand-written files; only the HTML is generated.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import wiggle from './wiggle-room.mjs';
import fern from './little-fern.mjs';

const out = new URL('../../public/demos/', import.meta.url);
let n = 0;
for (const site of [wiggle, fern]) {
  for (const page of site.pages) {
    const dir = new URL(`${site.slug}/${page.path}`, out);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL('index.html', dir), site.layout(page).replace(/ & /g, ' &amp; '));
    n++;
  }
}
console.log(`demos: wrote ${n} pages`);

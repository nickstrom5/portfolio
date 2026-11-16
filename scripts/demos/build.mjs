/**
 * Writes the concept sites as plain HTML.
 *
 *   npm run demos                                         into this repo's public/demos/
 *   npm run demos -- --target launchneat --out <repo>     into a LaunchNeat checkout's public/demos/
 *
 * Each site module exports { slug, pages, layout, heroSvg, fontFaces }. A site's CSS and the
 * shared site.js are hand-written files in public/demos/; only the HTML is generated. The
 * LaunchNeat target also copies those files across, self-hosts the fonts from that repo's
 * @fontsource packages, and writes a hero.svg per site for the examples-page cards.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTarget, target, lnCss } from './shared.mjs';
import wiggle from './wiggle-room.mjs';
import fern from './little-fern.mjs';

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
setTarget(arg('target') || 'portfolio');
const here = fileURLToPath(new URL('../../public/demos/', import.meta.url));
if (target.name !== 'portfolio' && !arg('out')) throw new Error('--out <path to the other repo> is required for this target');
const repo = arg('out') ? resolve(arg('out')) : null;
const out = repo ? join(repo, 'public/demos') : here;
const write = (file, text) => { mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, text); };

let n = 0;
for (const site of [wiggle, fern]) {
  for (const page of site.pages) {
    write(join(out, site.slug, page.path, 'index.html'), site.layout(page).replace(/ & /g, ' &amp; '));
    n++;
  }
  if (!repo) continue;
  copyFileSync(join(here, site.slug, 'styles.css'), join(out, site.slug, 'styles.css'));
  write(join(out, site.slug, 'hero.svg'), site.heroSvg);
  // Self-hosted fonts: [family, fontsource package, weight, style] -> woff2 copied from the other repo.
  const css = site.fontFaces.map(([family, pkg, weight, style]) => {
    const file = `${pkg}-latin-${weight}-${style}.woff2`;
    mkdirSync(join(out, 'fonts'), { recursive: true });
    copyFileSync(join(repo, 'node_modules/@fontsource', pkg, 'files', file), join(out, 'fonts', file));
    return `@font-face { font-family: '${family}'; font-style: ${style}; font-weight: ${weight}; font-display: swap; src: url(/demos/fonts/${file}) format('woff2'); }`;
  });
  write(join(out, 'fonts', `${site.slug}.css`), css.join('\n') + '\n');
}
if (repo) {
  copyFileSync(join(here, 'site.js'), join(out, 'site.js'));
  write(join(out, 'ln.css'), lnCss);
}
console.log(`demos: wrote ${n} pages for ${target.name} to ${out}`);

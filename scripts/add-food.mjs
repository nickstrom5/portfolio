#!/usr/bin/env node
/**
 * Adds photos to the unlisted /food/ page.
 *
 *   npm run food:add -- path/to/photo.jpg [more.jpg ...] [--name "Cacio e pepe"] [--date 2026-10-09 | --date none]
 *
 * Each photo is auto-rotated, resized to at most 2400px, re-encoded as JPEG and
 * saved to src/assets/food/<date>-<name>.jpg (or <name>.jpg with --date none) with ALL metadata removed. Phone
 * photos carry GPS location in their EXIF data, and this repo is public, so
 * never copy a photo into src/assets/food/ by hand: `npm run qa` fails if one
 * still has metadata.
 *
 * --name defaults to the file name, --date to today. The page shows the name as the
 * caption; set a title, a one-line note, alt text and the order in src/data/food.json.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

const OUT = 'src/assets/food';
const args = process.argv.slice(2);
const files = [];
let name;
let date = new Date().toISOString().slice(0, 10);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name') name = args[++i];
  else if (args[i] === '--date') date = args[++i];
  else files.push(args[i]);
}
if (!files.length) {
  console.error('Usage: npm run food:add -- photo.jpg [more.jpg ...] [--name "Dish name"] [--date YYYY-MM-DD | --date none]');
  process.exit(1);
}
if (date !== 'none' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`--date must look like 2026-10-09 (or none), got "${date}"`);
  process.exit(1);
}
if (name && files.length > 1) console.warn('Note: --name applies to every photo in this run.');

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // drop accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'photo';

mkdirSync(OUT, { recursive: true });
let failed = 0;
for (const file of files) {
  const base = slugify(name ?? basename(file, extname(file)));
  const stem = date === 'none' ? base : `${date}-${base}`;
  let target = join(OUT, `${stem}.jpg`);
  for (let n = 2; existsSync(target); n++) target = join(OUT, `${stem}-${n}.jpg`);
  try {
    // sharp writes no metadata unless asked to, so EXIF (GPS, camera, time) is dropped.
    await sharp(file)
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(target);
    const meta = await sharp(target).metadata();
    if (meta.exif || meta.xmp || meta.iptc) throw new Error('metadata survived re-encoding');
    console.log(`Added ${target} (${meta.width}x${meta.height}, metadata removed)`);
  } catch (err) {
    failed++;
    const heic = /\.hei[cf]$/i.test(file);
    console.error(`Could not add ${file}: ${err.message}${heic ? '\n  HEIC is not supported here: export the photo as JPEG first.' : ''}`);
  }
}
process.exit(failed ? 1 : 0);

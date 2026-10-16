/**
 * Fails if any image in the repo still carries photo metadata (EXIF, XMP or
 * IPTC). Phone photos carry the GPS location where they were taken, and this
 * repo is public, so nothing with metadata may be committed or deployed.
 *
 *   node scripts/check-photo-metadata.mjs
 *
 * Runs before every build (npm "prebuild", so the deploy fails too) and as the
 * git pre-commit hook in .githooks/. `npm run qa` runs it as well. Add food
 * photos with `npm run food:add`, which strips metadata; for any other image,
 * re-save it without metadata (sharp, Preview's Export, or ImageOptim).
 */
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const skip = new Set(['node_modules', '.git', 'dist', '.astro', '.vercel', '.next']);
const images = /\.(jpe?g|png|webp|avif|gif|tiff?|heic|heif)$/i;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (images.test(e.name)) out.push(full);
  }
  return out;
}

/** Returns one message per image that has metadata or can't be read. */
export async function findPhotoMetadata() {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    // Fail closed: without sharp nothing can be checked.
    return ['sharp is not installed, so image metadata cannot be checked (run npm ci)'];
  }
  const problems = [];
  for (const file of walk(root)) {
    const name = relative(root, file);
    try {
      const m = await sharp(file).metadata();
      const found = ['exif', 'xmp', 'iptc'].filter((k) => m[k]);
      if (found.length) problems.push(`${name}: has ${found.join(', ').toUpperCase()} metadata (may include GPS); re-save it without metadata`);
    } catch (e) {
      problems.push(`${name}: could not be read (${e.message}); convert it to JPEG or PNG without metadata`);
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = await findPhotoMetadata();
  if (problems.length) {
    console.error('Photo metadata check failed:\n' + problems.map((p) => '  ' + p).join('\n'));
    process.exit(1);
  }
  console.log('Photo metadata check: no EXIF, XMP or IPTC in any image.');
}

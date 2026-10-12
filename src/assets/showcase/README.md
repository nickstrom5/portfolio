# AI Projects screenshots

The screenshots on the AI Projects page (`/apps/`). `src/data/showcase.ts`
names them as `/showcase/<file>`, and `src/components/showcase/Shot.astro`
finds the file here by name and serves it as AVIF and WebP at the sizes each
device frame needs, with a JPEG fallback.

- Add or replace a screenshot here, under the same file name the data uses.
- `clam-site.jpg`, `goodwalk-site.jpg`, `launchneat-site.jpg` and
  `signalrig-site.jpg` also live in `public/showcase/`, because their case
  studies use them as the link-preview image (`cover`). Update both copies.
- Like every image in the repo, these must carry no EXIF, XMP or IPTC
  metadata; `npm run build` and the pre-commit hook check.

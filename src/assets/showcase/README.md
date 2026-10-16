# AI Projects screenshots

The screenshots on the AI Projects page (`/apps/`). `src/data/showcase.ts`
names them as `/showcase/<file>`, and `src/components/showcase/Shot.astro`
finds the file here by name and serves it as AVIF and WebP at the sizes each
device frame needs, with a JPEG fallback.

- Add or replace a screenshot here, under the same file name the data uses.
- A case study's `cover` (`/showcase/<file>`) must be a file here. Its link
  preview is cropped from the top of that screenshot to 1200×630 at build time.
- `public/showcase/` still holds older copies of `clam-site.jpg`,
  `goodwalk-site.jpg`, `launchneat-site.jpg` and `signalrig-site.jpg`, which
  the case studies used as their link preview before the crop, so previews
  already shared keep working. Nothing on the site uses them now; there is no
  need to update them.
- `site-home.jpg`, `site-clients.jpg` and `site-about.jpg` are screenshots of
  this site: `npm run build && npm run shots && npm run build` retakes them.
- Like every image in the repo, these must carry no EXIF, XMP or IPTC
  metadata; `npm run build` and the pre-commit hook check.

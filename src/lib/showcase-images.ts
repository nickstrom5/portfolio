import type { ImageMetadata } from 'astro';

/**
 * Screenshots live in src/assets/showcase so Astro can resize them and serve
 * AVIF and WebP. Data files keep naming them '/showcase/<file>', the way
 * they read on the page; this maps that name to the image, and a missing file
 * fails the build instead of shipping a broken image.
 */
const files = import.meta.glob<ImageMetadata>('/src/assets/showcase/*.{jpg,jpeg,png}', { eager: true, import: 'default' });

export function showcaseImage(path: string): ImageMetadata {
  const img = files[`/src/assets/showcase/${path.replace(/^\/?showcase\//, '')}`];
  if (!img) throw new Error(`No screenshot ${path} in src/assets/showcase`);
  return img;
}

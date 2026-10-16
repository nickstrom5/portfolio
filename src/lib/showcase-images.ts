import type { ImageMetadata } from 'astro';

const shots = import.meta.glob<{ default: ImageMetadata }>('/src/assets/showcase/*.{jpg,jpeg,png}', { eager: true });

/**
 * The screenshot in src/assets/showcase/ for a public-style path the data uses
 * ('/showcase/x.jpg', with or without the base), matched by file name.
 * Pass it to <Picture> or getImage; reading its .src or .width makes Astro
 * publish the untouched original as well.
 */
export function showcaseAsset(path: string): ImageMetadata | undefined {
  return shots[`/src/assets/showcase/${path.split('/').pop()}`]?.default;
}

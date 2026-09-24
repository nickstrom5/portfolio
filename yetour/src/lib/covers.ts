/**
 * Real album artwork, from Spotify's own oEmbed endpoint.
 *
 * Spotify's developer terms allow displaying cover art provided it is shown
 * unaltered — not cropped, not overlaid — and is accompanied by a link back to
 * the album on Spotify. Both hold here: tiles use `object-fit: contain` on a
 * square, and every record links out to its Spotify page.
 *
 * Resolution happens at build time. If the endpoint cannot be reached the
 * lookup returns undefined and the page falls back to its generated mark, so a
 * network failure degrades instead of breaking the build.
 */
import { coverCache } from '@/data/covers';

const resolved = new Map<string, string>(Object.entries(coverCache));
const inflight = new Map<string, Promise<string | undefined>>();

async function lookup(id: string): Promise<string | undefined> {
  try {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), 6000);
    const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/album/${id}`, {
      signal: control.signal,
      headers: { accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { thumbnail_url?: unknown };
    const url = typeof body.thumbnail_url === 'string' ? body.thumbnail_url : undefined;
    if (url) resolved.set(id, url);
    return url;
  } catch {
    return undefined;
  }
}

export async function albumCover(spotifyId?: string): Promise<string | undefined> {
  if (!spotifyId) return undefined;
  const hit = resolved.get(spotifyId);
  if (hit) return hit;
  if (!inflight.has(spotifyId)) inflight.set(spotifyId, lookup(spotifyId));
  return inflight.get(spotifyId);
}

/** The canonical album page, which Spotify's terms require us to link to. */
export function spotifyAlbumUrl(spotifyId: string): string {
  return `https://open.spotify.com/album/${spotifyId}`;
}

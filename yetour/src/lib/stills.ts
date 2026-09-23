/**
 * Real frames of the globe, served by YouTube from the uploads attached to
 * each show in tour.ts.
 *
 * YouTube exposes a fixed set of frames per video: `maxresdefault` is the
 * thumbnail, and the numbered frames sit at roughly a quarter, a half and
 * three quarters of the way through. Nothing is re-hosted — these are
 * YouTube's own URLs, and every still links back to the video it came from.
 */
import type { Show } from '@/data/tour';
import { shortPlace, longDate } from '@/data/tour';

export interface Still {
  src: string;
  alt: string;
  caption: string;
  watch: string;
  /** YouTube id, so a failed maxres frame can retry at a smaller size. */
  video: string;
}

const FRAMES = [
  { key: 'maxresdefault', when: 'Thumbnail frame' },
  { key: 'hq1', when: 'About a quarter in' },
  { key: 'hq2', when: 'Around the middle' },
  { key: 'hq3', when: 'About three quarters in' },
] as const;

export function frame(videoId: string, key: string): string {
  return `https://img.youtube.com/vi/${videoId}/${key}.jpg`;
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Every frame available for one show. */
export function stillsFor(show: Show): Still[] {
  const video = show.videos?.[0];
  if (!video) return [];
  return FRAMES.map((f) => ({
    src: frame(video.id, f.key),
    alt: `The globe stage at ${shortPlace(show)}, ${longDate(show.date)}`,
    caption: f.when,
    watch: watchUrl(video.id),
    video: video.id,
  }));
}

/** One frame per show, for the gallery that spans the whole tour. */
export function tourStills(shows: Show[]): (Still & { show: Show })[] {
  return shows
    .filter((s) => s.videos?.length)
    .map((s) => ({
      src: frame(s.videos![0]!.id, 'maxresdefault'),
      alt: `The globe stage at ${shortPlace(s)}, ${longDate(s.date)}`,
      caption: `${shortPlace(s)} · ${longDate(s.date)}`,
      watch: watchUrl(s.videos![0]!.id),
      video: s.videos![0]!.id,
      show: s,
    }));
}

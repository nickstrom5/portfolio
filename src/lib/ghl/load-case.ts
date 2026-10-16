/**
 * Each case's data as its own chunk, so a /ghl/ page downloads only the case
 * it shows instead of all three (about 140 KB gzipped saved up front).
 */
import type { CaseStudy } from './types';

const loaders: Record<string, () => Promise<CaseStudy>> = {
  roofing: () => import('@/data/ghl/roofing').then((m) => m.roofingCase),
  saas: () => import('@/data/ghl/saas').then((m) => m.saasCase),
  coaching: () => import('@/data/ghl/coaching').then((m) => m.coachingCase),
};

export const hasLoader = (id: string) => id in loaders;

export function loadCase(id: string): Promise<CaseStudy | undefined> {
  return loaders[id] ? loaders[id]() : Promise.resolve(undefined);
}

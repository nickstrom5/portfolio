/**
 * Each case's data as its own chunk, so /zapier/ downloads only the cases a
 * visitor opens instead of all three.
 */
import type { CaseStudy } from './types';

const loaders: Record<string, () => Promise<CaseStudy>> = {
  cleaning: () => import('@/data/zapier/cleaning').then((m) => m.cleaningCase),
  solar: () => import('@/data/zapier/solar').then((m) => m.solarCase),
  workshops: () => import('@/data/zapier/workshops').then((m) => m.workshopsCase),
};

export const hasLoader = (id: string) => id in loaders;

export function loadCase(id: string): Promise<CaseStudy | undefined> {
  return loaders[id] ? loaders[id]() : Promise.resolve(undefined);
}

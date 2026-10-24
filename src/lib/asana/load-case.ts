/**
 * Each case's data as its own chunk, so /asana/ downloads only the cases a
 * visitor opens instead of all three.
 */
import type { CaseStudy } from './types';

const loaders: Record<string, () => Promise<CaseStudy>> = {
  marketing: () => import('@/data/asana/marketing').then((m) => m.marketingCase),
  services: () => import('@/data/asana/services').then((m) => m.servicesCase),
  nonprofit: () => import('@/data/asana/nonprofit').then((m) => m.nonprofitCase),
};

export const hasLoader = (id: string) => id in loaders;

export function loadCase(id: string): Promise<CaseStudy | undefined> {
  return loaders[id] ? loaders[id]() : Promise.resolve(undefined);
}

/**
 * Each case's data as its own chunk, so /airtable/ downloads only the cases a
 * visitor opens instead of all three.
 */
import type { CaseStudy } from './types';

const loaders: Record<string, () => Promise<CaseStudy>> = {
  events: () => import('@/data/airtable/events').then((m) => m.eventsCase),
  rentals: () => import('@/data/airtable/rentals').then((m) => m.rentalsCase),
  recruiting: () => import('@/data/airtable/recruiting').then((m) => m.recruitingCase),
};

export const hasLoader = (id: string) => id in loaders;

export function loadCase(id: string): Promise<CaseStudy | undefined> {
  return loaders[id] ? loaders[id]() : Promise.resolve(undefined);
}

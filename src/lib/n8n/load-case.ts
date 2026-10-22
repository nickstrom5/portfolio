/**
 * Each case's data as its own chunk, so /n8n/ downloads only the cases a
 * visitor opens instead of all three.
 */
import type { CaseStudy } from './types';

const loaders: Record<string, () => Promise<CaseStudy>> = {
  coffee: () => import('@/data/n8n/coffee').then((m) => m.coffeeCase),
  bookkeeping: () => import('@/data/n8n/bookkeeping').then((m) => m.bookkeepingCase),
  recruiting: () => import('@/data/n8n/recruiting').then((m) => m.recruitingCase),
};

export const hasLoader = (id: string) => id in loaders;

export function loadCase(id: string): Promise<CaseStudy | undefined> {
  return loaders[id] ? loaders[id]() : Promise.resolve(undefined);
}

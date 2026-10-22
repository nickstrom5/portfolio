/**
 * Each case's data as its own chunk, so /clickup/ downloads only the cases a
 * visitor opens instead of all three.
 */
import type { CaseStudy } from './types';

const loaders: Record<string, () => Promise<CaseStudy>> = {
  agency: () => import('@/data/clickup/agency').then((m) => m.agencyCase),
  ops: () => import('@/data/clickup/ops').then((m) => m.opsCase),
  product: () => import('@/data/clickup/product').then((m) => m.productCase),
};

export const hasLoader = (id: string) => id in loaders;

export function loadCase(id: string): Promise<CaseStudy | undefined> {
  return loaders[id] ? loaders[id]() : Promise.resolve(undefined);
}

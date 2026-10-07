/**
 * Browser-side loaders, one per case, so each /ghl/ page downloads only the
 * case it shows. Keep the keys in step with the business ids in ./index.
 */
import type { CaseStudy } from '@/lib/ghl/types';

export const loadCase: Record<string, () => Promise<CaseStudy>> = {
  roofing: () => import('./roofing').then((m) => m.roofingCase),
  saas: () => import('./saas').then((m) => m.saasCase),
  coaching: () => import('./coaching').then((m) => m.coachingCase),
};

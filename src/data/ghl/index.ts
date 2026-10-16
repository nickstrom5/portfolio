/**
 * Everything /ghl/ shows: three case studies, each a sample sub-account with
 * a landing page and its workflows. Checked by `npm run ghl:check`. Each case
 * has its own page, and the page script loads that case's data on its own
 * (src/lib/ghl/load-case.ts), so a case added here needs a loader there too;
 * GhlPage.astro fails the build otherwise.
 */
import type { CaseStudy } from '@/lib/ghl/types';
import { roofingCase } from './roofing';
import { saasCase } from './saas';
import { coachingCase } from './coaching';

/** Small local business, tech company, then online coaching. The first one is the /ghl/ page itself. */
export const cases: CaseStudy[] = [roofingCase, saasCase, coachingCase];

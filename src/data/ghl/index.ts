/**
 * Everything /ghl/ shows: three case studies, each a sample sub-account with
 * a landing page and its workflows. Checked by `npm run ghl:check`. The page
 * script loads each case on its own (src/lib/ghl/load-case.ts), so a case
 * added here needs a loader there too; ghl.astro fails the build otherwise.
 */
import type { CaseStudy } from '@/lib/ghl/types';
import { roofingCase } from './roofing';
import { saasCase } from './saas';
import { coachingCase } from './coaching';

/** Small local business, tech company, then online coaching. */
export const cases: CaseStudy[] = [roofingCase, saasCase, coachingCase];

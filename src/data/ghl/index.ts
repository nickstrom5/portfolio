/**
 * Everything /ghl/ shows: three case studies, each a sample sub-account with
 * a landing page and its workflows. Checked by `npm run ghl:check`.
 * Pages import this; browser code loads one case at a time through ./load.
 */
import type { CaseStudy } from '@/lib/ghl/types';
import { roofingCase } from './roofing';
import { saasCase } from './saas';
import { coachingCase } from './coaching';

/** Small local business, tech company, then online coaching. The first one is the /ghl/ page itself. */
export const cases: CaseStudy[] = [roofingCase, saasCase, coachingCase];

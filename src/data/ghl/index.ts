/**
 * Everything /ghl/ shows: three case studies, each a sample sub-account with
 * a landing page and its workflows. Checked by `npm run ghl:check`.
 */
import type { CaseStudy } from '@/lib/ghl/types';
import { roofingBusiness } from './business';
import { roofingLanding } from './landing';
import { speedToLead } from './automations/speed-to-lead';
import { saasCase } from './saas';
import { coachingCase } from './coaching';

const roofingCase: CaseStudy = { business: roofingBusiness, landing: roofingLanding, automations: [speedToLead] };

/** Small local business, tech company, then online coaching. */
export const cases: CaseStudy[] = [roofingCase, saasCase, coachingCase];

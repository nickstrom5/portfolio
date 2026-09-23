/**
 * Everything /ghl/ shows: three case studies, each a sample sub-account with
 * a landing page and its workflows. Checked by `npm run ghl:check`.
 */
import type { CaseStudy } from '@/lib/ghl/types';
import { roofingBusiness } from './business';
import { roofingLanding } from './landing';
import { speedToLead } from './automations/speed-to-lead';
import { missedCall } from './automations/missed-call';
import { inspectionBooked } from './automations/inspection-booked';
import { estimateFollowUp } from './automations/estimate-follow-up';
import { jobHandoff } from './automations/job-handoff';
import { reviewsReferrals } from './automations/reviews-referrals';
import { reactivation } from './automations/reactivation';
import { saasCase } from './saas';
import { coachingCase } from './coaching';

const roofingCase: CaseStudy = { business: roofingBusiness, landing: roofingLanding, automations: [speedToLead, missedCall, inspectionBooked, estimateFollowUp, jobHandoff, reviewsReferrals, reactivation] };

/** Small local business, tech company, then online coaching. */
export const cases: CaseStudy[] = [roofingCase, saasCase, coachingCase];

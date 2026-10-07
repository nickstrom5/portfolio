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

/** Workflows in page order. Each file lives in ./automations. */
export const roofingCase: CaseStudy = { business: roofingBusiness, landing: roofingLanding, automations: [speedToLead, missedCall, inspectionBooked, estimateFollowUp, jobHandoff, reviewsReferrals, reactivation] };

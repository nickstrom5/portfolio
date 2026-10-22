/** The marketing case: Brightline Outdoor's request queue, launch plan and four automations. */
import type { CaseStudy } from '@/lib/asana/types';
import { marketingOrg } from './org';
import { requestTriage } from './automations/request-triage';
import { rushFlag } from './automations/rush-flag';
import { reviewHandoff } from './automations/review-handoff';
import { signOff } from './automations/sign-off';

export const marketingCase: CaseStudy = { ...marketingOrg, automations: [requestTriage, rushFlag, reviewHandoff, signOff] };

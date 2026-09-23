import type { CaseStudy } from '@/lib/ghl/types';
import { business } from './business';
import { landing } from './landing';
import { demoRequest } from './automations/demo-request';
import { trialOnboarding } from './automations/trial-onboarding';
import { pqlAlert } from './automations/pql-alert';
import { trialEnding } from './automations/trial-ending';
import { closedWon } from './automations/closed-won';
import { npsHealth } from './automations/nps-health';

/** Workflows in page order. Each file lives in ./automations. */
export const saasCase: CaseStudy = { business, landing, automations: [demoRequest, trialOnboarding, pqlAlert, trialEnding, closedWon, npsHealth] };

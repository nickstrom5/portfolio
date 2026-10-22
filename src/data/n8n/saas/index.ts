import type { CaseStudy } from '@/lib/n8n/types';
import { business } from './business';
import { demo } from './demo';
import { supportTriage } from './automations/support-triage';
import { usageSync } from './automations/usage-sync';
import { failedPayment } from './automations/failed-payment';

/** Workflows in page order. Each file lives in ./automations. */
export const saasCase: CaseStudy = { business, demo, automations: [supportTriage, usageSync, failedPayment] };

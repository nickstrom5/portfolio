import type { CaseStudy } from '@/lib/airtable/types';
import { business } from './business';
import { base } from './base';
import { demo } from './demo';
import { damageReport } from './automations/damage-report';
import { reorder } from './automations/reorder';
import { conflictCheck } from './automations/conflict-check';

/** Automations in page order. Each file lives in ./automations. */
export const rentalsCase: CaseStudy = { business, base, demo, automations: [damageReport, reorder, conflictCheck] };

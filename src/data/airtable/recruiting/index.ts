import type { CaseStudy } from '@/lib/airtable/types';
import { business } from './business';
import { base } from './base';
import { demo } from './demo';
import { newApplication } from './automations/new-application';
import { stageChange } from './automations/stage-change';
import { guaranteeCheckins } from './automations/guarantee-checkins';

/** Automations in page order. Each file lives in ./automations. */
export const recruitingCase: CaseStudy = { business, base, demo, automations: [newApplication, stageChange, guaranteeCheckins] };

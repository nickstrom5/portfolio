import type { CaseStudy } from '@/lib/ghl/types';
import { business } from './business';
import { landing } from './landing';

/** Workflows in page order. Each file lives in ./automations. */
export const coachingCase: CaseStudy = { business, landing, automations: [] };

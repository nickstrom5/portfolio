import type { CaseStudy } from '@/lib/n8n/types';
import { business } from './business';
import { demo } from './demo';
import { applicationIntake } from './automations/application-intake';
import { screenBooked } from './automations/screen-booked';
import { clientPipeline } from './automations/client-pipeline';

/** Workflows in page order. Each file lives in ./automations. */
export const recruitingCase: CaseStudy = { business, demo, automations: [applicationIntake, screenBooked, clientPipeline] };

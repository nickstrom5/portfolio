import type { CaseStudy } from '@/lib/airtable/types';
import { business } from './business';
import { base } from './base';
import { demo } from './demo';
import { newPitch } from './automations/new-pitch';
import { pitchAccepted } from './automations/pitch-accepted';
import { slidesChase } from './automations/slides-chase';

/** Automations in page order. Each file lives in ./automations. */
export const eventsCase: CaseStudy = { business, base, demo, automations: [newPitch, pitchAccepted, slidesChase] };

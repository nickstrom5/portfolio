import type { CaseStudy } from '@/lib/n8n/types';
import { business } from './business';
import { demo } from './demo';
import { clientOnboarding } from './automations/client-onboarding';
import { documentChase } from './automations/document-chase';
import { errorHandler } from './automations/error-handler';

/** Workflows in page order. Each file lives in ./automations. */
export const bookkeepingCase: CaseStudy = { business, demo, automations: [clientOnboarding, documentChase, errorHandler] };

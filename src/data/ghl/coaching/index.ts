import type { CaseStudy } from '@/lib/ghl/types';
import { business } from './business';
import { landing } from './landing';
import { webinar } from './automations/webinar';
import { cartRecovery } from './automations/cart-recovery';
import { onboarding } from './automations/onboarding';
import { failedPayment } from './automations/failed-payment';
import { application } from './automations/application';
import { completion } from './automations/completion';

/** Workflows in page order. Each file lives in ./automations. */
export const coachingCase: CaseStudy = { business, landing, automations: [webinar, cartRecovery, onboarding, failedPayment, application, completion] };

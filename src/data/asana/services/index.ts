/** The professional-services case: Northfield Advisory's intake board, onboarding template and five automations. */
import type { CaseStudy } from '@/lib/asana/types';
import { servicesOrg } from './org';
import { inquiryRouting } from './automations/inquiry-routing';
import { conflictCheck } from './automations/conflict-check';
import { engaged } from './automations/engaged';
import { clientReminders } from './automations/client-reminders';
import { overdueEscalation } from './automations/overdue-escalation';

export const servicesCase: CaseStudy = { ...servicesOrg, automations: [inquiryRouting, conflictCheck, engaged, clientReminders, overdueEscalation] };

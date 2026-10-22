import type { CaseStudy } from '@/lib/n8n/types';
import { business } from './business';
import { demo } from './demo';
import { wholesaleInquiry } from './automations/wholesale-inquiry';
import { roastQueue } from './automations/roast-queue';
import { stockCheck } from './automations/stock-check';

/** Workflows in page order. Each file lives in ./automations. */
export const coffeeCase: CaseStudy = { business, demo, automations: [wholesaleInquiry, roastQueue, stockCheck] };

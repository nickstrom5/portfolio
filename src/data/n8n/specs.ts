/**
 * n8n's own node settings for every workflow on /n8n/, by case and workflow
 * id. Used at build time only (the JSON endpoint and the check), so none of
 * it ships in the page's script.
 */
import type { Specs } from '@/lib/n8n/export';
import { coffeeSpecs } from './coffee/n8n-json';
import { bookkeepingSpecs } from './bookkeeping/n8n-json';
import { recruitingSpecs } from './recruiting/n8n-json';

export const specs: Record<string, Record<string, Specs>> = {
  coffee: coffeeSpecs,
  bookkeeping: bookkeepingSpecs,
  recruiting: recruitingSpecs,
};

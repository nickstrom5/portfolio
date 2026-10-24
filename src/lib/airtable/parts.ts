/**
 * The parts of an /airtable/ case that can load when opened (src/lib/parts.ts):
 * its base's tables, its form and each automation's body. CaseStudy.astro
 * leaves a slot for every part `inFull` rules out; /airtable/parts/<case>.json
 * renders those parts.
 */
import AutomationBody from '@/components/airtable/AutomationBody.astro';
import BaseTables from '@/components/airtable/BaseTables.astro';
import DemoForm from '@/components/airtable/DemoForm.astro';
import { inFull } from '@/lib/parts';
import type { Part } from '@/lib/parts-render';
import type { CaseStudy } from './types';

/** How the page names the automation a case's form feeds, and that automation's trigger type. */
export function fedBy({ automations, demo }: CaseStudy) {
  const fed = automations.find((a) => a.id === demo.feeds);
  return { feedsName: fed ? `automation ${fed.number} · ${fed.name}` : 'the first automation', triggerType: fed?.trigger.type ?? 'form' };
}

/** The parts of the case at `index` on the page that its HTML leaves out. */
export function deferredParts(study: CaseStudy, index: number): Part[] {
  const id = study.business.id;
  const parts: Part[] = [];
  if (!inFull(index)) {
    parts.push({ id: `${id}/base`, component: BaseTables, props: { base: study.base } });
    parts.push({ id: `${id}/demo`, component: DemoForm, props: { caseId: id, demo: study.demo, ...fedBy(study) } });
  }
  study.automations.forEach((a, i) => {
    if (!inFull(index, i)) parts.push({ id: `${id}/${a.id}`, component: AutomationBody, props: { automation: a, caseId: id } });
  });
  return parts;
}

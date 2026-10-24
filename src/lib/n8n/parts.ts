/**
 * The parts of an /n8n/ case that can load when opened (src/lib/parts.ts): its
 * test form and each workflow's body. CaseStudy.astro leaves a slot for every
 * part `inFull` rules out; /n8n/parts/<case>.json renders those parts.
 */
import AutomationBody from '@/components/n8n/AutomationBody.astro';
import DemoForm from '@/components/n8n/DemoForm.astro';
import { inFull } from '@/lib/parts';
import type { Part } from '@/lib/parts-render';
import type { CaseStudy } from './types';

/** How the page names the workflow a case's test form feeds, and that workflow's trigger type. */
export function fedBy({ automations, demo }: CaseStudy) {
  const fed = automations.find((a) => a.id === demo.feeds);
  return { feedsName: fed ? `workflow ${fed.number} · ${fed.name}` : 'the first workflow', triggerType: fed?.workflow.trigger.type ?? 'trigger' };
}

/** Each workflow's n8n name by id, for the canvases. */
export const workflowNames = ({ automations }: CaseStudy) => Object.fromEntries(automations.map((a) => [a.id, a.workflow.name]));

/** The parts of the case at `index` on the page that its HTML leaves out. */
export function deferredParts(study: CaseStudy, index: number): Part[] {
  const id = study.business.id;
  const names = workflowNames(study);
  const parts: Part[] = [];
  if (!inFull(index)) parts.push({ id: `${id}/demo`, component: DemoForm, props: { caseId: id, demo: study.demo, ...fedBy(study) } });
  study.automations.forEach((a, i) => {
    if (!inFull(index, i)) parts.push({ id: `${id}/${a.id}`, component: AutomationBody, props: { automation: a, caseId: id, names } });
  });
  return parts;
}

/**
 * The parts of an /asana/ case that can load when opened (src/lib/parts.ts):
 * its intake form, project views, reporting, screenshots and each
 * automation's body. CaseStudy.astro leaves a slot for every part `inFull`
 * rules out; /asana/parts/<case>.json renders those parts.
 */
import AutomationBody from '@/components/asana/AutomationBody.astro';
import FormDemo from '@/components/asana/FormDemo.astro';
import Gallery from '@/components/asana/Gallery.astro';
import ProjectViews from '@/components/asana/ProjectViews.astro';
import Reporting from '@/components/asana/Reporting.astro';
import { screenshots } from '@/data/asana/screenshots';
import { inFull } from '@/lib/parts';
import type { Part } from '@/lib/parts-render';
import type { Automation, CaseStudy } from './types';

/** What an automation's body needs from its case: the fields, its project and the team's names. */
export function bodyProps(study: CaseStudy, a: Automation) {
  return {
    fields: study.fields,
    project: study.projects.find((p) => p.id === a.automation.project),
    people: Object.fromEntries(study.org.team.map((p) => [p.key, { name: p.name }])),
  };
}

/** The parts of the case at `index` on the page that its HTML leaves out. */
export function deferredParts(study: CaseStudy, index: number): Part[] {
  const id = study.org.id;
  const shots = screenshots[id] ?? [];
  const parts: Part[] = [];
  if (!inFull(index)) {
    parts.push({ id: `${id}/form`, component: FormDemo, props: { study } });
    parts.push({ id: `${id}/projects`, component: ProjectViews, props: { study } });
    parts.push({ id: `${id}/reporting`, component: Reporting, props: { study } });
    if (shots.length) parts.push({ id: `${id}/in-asana`, component: Gallery, props: { caseId: id, shots } });
  }
  study.automations.forEach((a, i) => {
    if (!inFull(index, i)) parts.push({ id: `${id}/${a.id}`, component: AutomationBody, props: { automation: a, caseId: id, ...bodyProps(study, a) } });
  });
  return parts;
}

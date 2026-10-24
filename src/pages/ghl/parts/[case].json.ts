/**
 * /ghl/parts/<case>.json: the parts of a case that /ghl/ leaves out of its
 * HTML (src/lib/parts.ts), rendered by the same components. The page fetches
 * a case's file when that case, or one of its later workflows, is opened.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { cases as allCases } from '@/data/ghl';
import { deferredParts } from '@/lib/ghl/parts';
import { partsResponse } from '@/lib/parts-render';

// The cases ghl.astro shows, in its order: a case appears once it has workflows.
const cases = allCases.filter((c) => c.automations.length > 0);

export const getStaticPaths = (() => cases.map((study, index) => ({ params: { case: study.business.id }, props: { study, index } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => partsResponse(deferredParts(props.study, props.index));

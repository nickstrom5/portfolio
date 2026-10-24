/**
 * /n8n/parts/<case>.json: the parts of a case that /n8n/ leaves out of its
 * HTML (src/lib/parts.ts), rendered by the same components. The page fetches
 * a case's file when that case, or one of its later workflows, is opened.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { cases as allCases } from '@/data/n8n';
import { deferredParts } from '@/lib/n8n/parts';
import { partsResponse } from '@/lib/parts-render';

// The cases n8n.astro shows, in its order: a case appears once it has workflows.
const cases = allCases.filter((c) => c.automations.length > 0);

export const getStaticPaths = (() => cases.map((study, index) => ({ params: { case: study.business.id }, props: { study, index } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => partsResponse(deferredParts(props.study, props.index));

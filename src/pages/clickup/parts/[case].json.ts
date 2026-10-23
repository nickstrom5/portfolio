/**
 * /clickup/parts/<case>.json: the parts of a case that /clickup/ leaves out of
 * its HTML (src/lib/parts.ts), rendered by the same components. The page
 * fetches a case's file when that case, or one of its later processes, is opened.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { cases as allCases } from '@/data/clickup';
import { deferredParts } from '@/lib/clickup/parts';
import { partsResponse } from '@/lib/parts-render';

// The cases clickup.astro shows, in its order: a case appears once it has processes.
const cases = allCases.filter((c) => c.processes.length > 0);

export const getStaticPaths = (() => cases.map((study, index) => ({ params: { case: study.workspace.id }, props: { study, index } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => partsResponse(deferredParts(props.study, props.index));

/**
 * /zapier/parts/<case>.json: the parts of a case that /zapier/ leaves out of
 * its HTML (src/lib/parts.ts), rendered by the same components. The page
 * fetches a case's file when that case, or one of its later Zaps, is opened.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { cases as allCases } from '@/data/zapier';
import { deferredParts } from '@/lib/zapier/parts';
import { partsResponse } from '@/lib/parts-render';

// The cases zapier.astro shows, in its order: a case appears once it has Zaps.
const cases = allCases.filter((c) => c.zaps.length > 0);

export const getStaticPaths = (() => cases.map((study, index) => ({ params: { case: study.business.id }, props: { study, index } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => partsResponse(deferredParts(props.study, props.index));

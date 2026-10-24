/**
 * /asana/parts/<case>.json: the parts of a case that /asana/ leaves out of its
 * HTML (src/lib/parts.ts), rendered by the same components. The page fetches
 * a case's file when that case, or one of its later automations, is opened.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { cases } from '@/data/asana';
import { deferredParts } from '@/lib/asana/parts';
import { partsResponse } from '@/lib/parts-render';

export const getStaticPaths = (() => cases.map((study, index) => ({ params: { case: study.org.id }, props: { study, index } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => partsResponse(deferredParts(props.study, props.index));

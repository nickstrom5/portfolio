/**
 * /n8n/workflows/<case>-<workflow>.json: each workflow on /n8n/ as the JSON
 * n8n imports. The Copy for n8n buttons fetch these; pasting one onto an n8n
 * canvas, or importing the file, rebuilds the workflow node for node.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { cases } from '@/data/n8n';
import { specs } from '@/data/n8n/specs';
import { toN8nJson } from '@/lib/n8n/export';

export const getStaticPaths = (() =>
  cases.flatMap((c) =>
    c.automations.map((a) => ({
      params: { file: `${c.business.id}-${a.id}` },
      props: { json: toN8nJson(a, specs[c.business.id][a.id], c.business.id) },
    })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.json, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

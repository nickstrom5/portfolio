/**
 * Builds the <page>/parts/<case>.json files that src/lib/parts.ts reads: each
 * part a platform page leaves out of its HTML, rendered at build time by the
 * same component the page would have used, so a part fetched later is exactly
 * what the page would have sent.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';

type Component = Parameters<AstroContainer['renderToString']>[0];
/** A deferred part: its "<case>/<part>" key (the slot's data-part) and how to render it. */
export type Part = { id: string; component: Component; props: Record<string, unknown> };

let container: Promise<AstroContainer> | undefined;

export async function partsResponse(parts: Part[]): Promise<Response> {
  container ??= AstroContainer.create();
  const c = await container;
  const out: Record<string, string> = {};
  for (const p of parts) out[p.id] = await c.renderToString(p.component, { props: p.props });
  return new Response(JSON.stringify({ parts: out }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

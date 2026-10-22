/**
 * Small builders for the parameter shapes n8n's own nodes use, so each
 * case's n8n-json files read like the node panels they describe. Shapes
 * follow the node versions named in each spec (If 2.2, Switch 3.2, Set 3.4,
 * Merge 3.2, Filter 2.2…) as exported by n8n 2.x.
 */
import type { Json } from '@/lib/n8n/types';

let n = 0;
/** Ids n8n gives conditions and assignments; any unique string works on import. */
const id = (p: string) => `${p}-${(++n).toString(36).padStart(4, '0')}`;

type Op =
  | { type: 'string'; operation: 'equals' | 'notEquals' | 'contains' | 'startsWith' | 'regex' | 'notEmpty' | 'empty' | 'exists' }
  | { type: 'number'; operation: 'gt' | 'gte' | 'lt' | 'lte' | 'equals' }
  | { type: 'boolean'; operation: 'true' | 'false' }
  | { type: 'array'; operation: 'notEmpty' | 'empty' }
  | { type: 'object'; operation: 'exists' };

/** One condition: left value, operator, right value. Unary operators take no right value. */
export const cond = (left: string, op: Op, right?: string | number): Json => ({
  id: id('c'),
  leftValue: left,
  rightValue: right ?? '',
  operator: { ...op, ...(['notEmpty', 'empty', 'exists', 'true', 'false'].includes(op.operation) ? { singleValue: true } : {}) },
});

/** The filter block If, Filter and Switch rules share. */
export const conditions = (list: Json[], combinator: 'and' | 'or' = 'and', looseTypes = false): Json => ({
  options: { caseSensitive: true, leftValue: '', typeValidation: looseTypes ? 'loose' : 'strict', version: 2 },
  conditions: list,
  combinator,
});

/** If node parameters. */
export const ifParams = (list: Json[], combinator: 'and' | 'or' = 'and', looseTypes = false): Json => ({
  conditions: conditions(list, combinator, looseTypes),
  ...(looseTypes ? { looseTypeValidation: true } : {}),
  options: {},
});

/** Switch node parameters in Rules mode, one renamed output per rule, optional fallback output. */
export const switchParams = (rules: { key: string; when: Json[] }[], fallback?: string): Json => ({
  rules: { values: rules.map((r) => ({ conditions: conditions(r.when), renameOutput: true, outputKey: r.key })) },
  options: fallback ? { fallbackOutput: 'extra', renameFallbackOutput: fallback } : {},
});

/** Edit Fields (Set) 3.4 assignments. */
export const assign = (fields: [name: string, value: string | number | boolean, type?: 'string' | 'number' | 'boolean' | 'array' | 'object'][], includeOther = false): Json => ({
  assignments: { assignments: fields.map(([name, value, type]) => ({ id: id('a'), name, value, type: type ?? (typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string') })) },
  ...(includeOther ? { includeOtherFields: true } : {}),
  options: {},
});

/** A resource locator value (document, channel, base, table…). */
export const rl = (value: string, mode: 'list' | 'id' | 'name' | 'url' | 'username' = 'list', cachedResultName?: string): Json => ({
  __rl: true,
  value,
  mode,
  ...(cachedResultName ? { cachedResultName } : {}),
});

/** OpenAI chat model sub-node for the AI root nodes. */
export const openAiModel = (credential: string, model = 'gpt-4.1-mini') => ({
  name: 'OpenAI Chat Model',
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  typeVersion: 1.2,
  parameters: { model: rl(model, 'list', model), options: { temperature: 0 } },
  credentialType: 'openAiApi',
  credential,
});

/** An expression: n8n stores them with a leading =. */
export const ex = (s: string) => `=${s}`;

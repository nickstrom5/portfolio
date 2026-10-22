/**
 * Builds the /asana/ case studies in a real Asana workspace, for screenshots
 * of the real thing. Meant for a trial or sandbox workspace, never one with
 * real work in it.
 *
 *   npm run asana:seed -- --dry-run                 (no token needed: prints the plan)
 *   ASANA_TOKEN=... npm run asana:seed               (lists your workspaces)
 *   ASANA_TOKEN=... ASANA_WORKSPACE=<gid> npm run asana:seed
 *   ... npm run asana:seed -- --case marketing       (one case: marketing, services or nonprofit)
 *
 * The token is a personal access token (Asana › My settings › Apps ›
 * Developer apps). It is read from the environment only and never written
 * anywhere.
 *
 * What it creates, from src/data/asana: one team per case (in an
 * organization), the custom fields with their options, every project with its
 * sections, fields and default view, the sample tasks with real subtask
 * names, dates, milestones, approvals and dependencies, a status update on
 * every project, the portfolio, and the goal tree with progress and linked
 * projects. Tasks are assigned to you (the token's user), with the case
 * study's owner named in the description; set ASANA_ASSIGN=none to leave them
 * unassigned. Dates count from next Monday, or from ASANA_START (YYYY-MM-DD).
 *
 * What it can't create: Asana's API has no way to make forms or automations
 * (rules), and Workload needs the portfolio's effort field picked by hand. So
 * it also writes asana-seed-output/build-sheet.md: every form question and
 * setting, and every automation's triggers, paths and actions in the order
 * the builder asks for them, to click together in about an hour.
 *
 * Re-running skips projects that already exist (by name, in the same team),
 * so a failed run can be resumed. To start over, delete the trial workspace's
 * teams or the workspace itself.
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const only = args.includes('--case') ? args[args.indexOf('--case') + 1] : undefined;
const token = process.env.ASANA_TOKEN;
const workspaceGid = process.env.ASANA_WORKSPACE;
const assignToMe = process.env.ASANA_ASSIGN !== 'none';

const out = await build({
  stdin: { contents: "export { cases } from './src/data/asana/index.ts'; export * from './src/lib/asana/engine.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { cases: allCases, describeTrigger, describeCondition, describeAction, test } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const cases = allCases.filter((c) => !only || c.org.id === only);
if (!cases.length) {
  console.error(`No case "${only}". Pick one of: ${allCases.map((c) => c.org.id).join(', ')}.`);
  process.exit(1);
}

/* ---------- Dates: day 0 of the case data is a Monday ---------- */

const monday = (() => {
  if (process.env.ASANA_START) return new Date(`${process.env.ASANA_START}T12:00:00`);
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return d;
})();
const dateOf = (day) => {
  const d = new Date(monday);
  d.setDate(d.getDate() + day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---------- The build sheet: what has to be made by hand ---------- */

function buildSheet() {
  const lines = ['# Asana build sheet', '', 'Forms and automations can’t be created through Asana’s API. Build them in each project from Customize, in this order.', ''];
  for (const c of cases) {
    const people = Object.fromEntries(c.org.team.map((p) => [p.key, { name: p.name }]));
    lines.push(`## ${c.org.name}`, '');
    const f = c.form;
    lines.push(`### Form: ${f.title} (project ${f.project})`, '', `Customize › Add › Forms. Description: “${f.description}”`, '');
    lines.push('| Question | Type | Required | Maps to | Branching |', '| --- | --- | --- | --- | --- |');
    for (const q of f.questions) {
      const maps = q.maps === 'title' ? 'Task name' : q.maps === 'requester' ? 'Name (default question)' : q.maps === 'email' ? 'Email (default question)' : q.maps ? `Field: ${q.maps.field}` : '—';
      const type = q.type === 'select' ? `Single-select: ${q.options.join(', ')}` : q.type === 'textarea' ? 'Paragraph' : q.type === 'date' ? 'Date' : 'Short answer';
      lines.push(`| ${q.label} | ${type} | ${q.required ? 'Yes' : 'No'} | ${maps} | ${q.showIf ? `Only when ${f.questions.find((o) => o.name === q.showIf.question)?.label} is ${q.showIf.is.join(' or ')}` : '—'} |`);
    }
    lines.push('', `Settings: tasks land in **${f.section}**${f.defaultAssignee ? `, default assignee ${people[f.defaultAssignee]?.name}` : ', no default assignee'}; copy answers to the description; confirmation message (Asana can’t insert the submitter’s name): “${f.confirmation.replace(/, \{first\}/, '')}”`, '');
    for (const a of c.automations) {
      const d = a.automation;
      lines.push(`### Automation ${d.name} (project ${d.project})`, '', 'Customize › Automations › Add › Start from scratch.', '');
      lines.push(`- **Triggers** (any of): ${d.triggers.map((t) => { const x = describeTrigger(t); return x.title + (x.detail ? ` (${x.detail})` : ''); }).join('; ')}`);
      d.actions.forEach((x) => lines.push(`- **Action:** ${describeAction(x, people).kind}: ${describeAction(x, people).summary}`));
      for (const p of d.paths ?? []) {
        lines.push(`- **Path “${p.label}”**, ${p.when.length ? `conditions: ${p.when.map((w) => describeCondition(w)).join(' AND ')}` : 'condition: No other path is matching'}`);
        p.actions.forEach((x) => lines.push(`  - ${describeAction(x, people).kind}: ${describeAction(x, people).summary}`));
      }
      lines.push(`- **Settings:** triggered by other automations ${d.settings.triggeredByOthers ? 'on' : 'off'}; runs on ${d.settings.runsOn === 'tasks' ? 'tasks' : 'tasks and subtasks'}`, '');
    }
    lines.push(`### Workload`, '', `Open the portfolio “${c.portfolio.name}”, add a Workload tab and set its effort field to **Effort**. Capacities in the case study: ${c.org.team.filter((p) => p.capacity).map((p) => `${p.name} ${p.capacity}`).join(', ')} points a week.`, '');
  }
  lines.push('Slack actions need Asana for Slack connected first. Assignees in the automations are the case study’s people; point them at real users (or yourself) in the trial.');
  mkdirSync('asana-seed-output', { recursive: true });
  writeFileSync('asana-seed-output/build-sheet.md', lines.join('\n') + '\n');
  console.log('Wrote asana-seed-output/build-sheet.md (forms and automations to build by hand).');
}

/* ---------- The API ---------- */

let calls = 0;
const dryLog = [];
async function api(method, path, data) {
  if (dry) {
    dryLog.push(`${method} ${path}${data ? ` ${JSON.stringify(data)}` : ''}`);
    return { gid: `dry-${++calls}` };
  }
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(data ? { 'Content-Type': 'application/json' } : {}) },
      body: data ? JSON.stringify({ data }) : undefined,
    });
    calls++;
    if (res.status === 429 && attempt < 5) {
      const wait = Number(res.headers.get('retry-after') ?? 30);
      console.log(`  rate limited, waiting ${wait}s…`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      console.error('Asana rejected the token (401). Check ASANA_TOKEN is your full personal access token, not a placeholder, and hasn’t been revoked.');
      process.exit(1);
    }
    if (res.status === 402) {
      console.error(`Asana says this workspace’s plan doesn’t include something the cases use (${method} ${path.split('?')[0]}). Start an Asana Advanced trial for the workspace (the Upgrade button in Asana), then run again; projects already made are skipped.`);
      process.exit(1);
    }
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${body.errors?.map((e) => e.message).join('; ') ?? res.statusText}`);
    return body.data;
  }
}
/** GET with pagination. */
async function list(path) {
  if (dry) return [];
  const items = [];
  let url = `${path}${path.includes('?') ? '&' : '?'}limit=100`;
  for (;;) {
    const res = await fetch(`https://app.asana.com/api/1.0${url}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const body = await res.json();
    if (!res.ok) throw new Error(`GET ${url}: ${res.status} ${body.errors?.map((e) => e.message).join('; ')}`);
    items.push(...body.data);
    if (!body.next_page?.offset) return items;
    url = `${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${body.next_page.offset}`;
  }
}
/** Optional extras (goals, status updates) log a warning instead of stopping the run. */
async function tryApi(what, fn) {
  try {
    return await fn();
  } catch (e) {
    console.warn(`  ! ${what} skipped: ${e.message}`);
  }
}

/* ---------- Mapping the case data to Asana ---------- */

const statusType = { 'On track': 'on_track', 'At risk': 'at_risk', 'Off track': 'off_track', 'On hold': 'on_hold', Complete: 'complete' };
const goalStatus = { 'On track': 'green', 'At risk': 'yellow', 'Off track': 'red' };
const viewOf = { List: 'list', Board: 'board', Timeline: 'timeline', Calendar: 'calendar' };
const colors = ['dark-orange', 'dark-teal', 'dark-blue', 'dark-purple', 'dark-green', 'dark-pink'];
const subtypeOf = { 'single-select': 'enum', 'multi-select': 'multi_enum', number: 'number', text: 'text', date: 'date', people: 'people' };

/** Real subtask names for a sample task: the checklist the automation that made it would have added. */
function subtaskNames(c, project, t) {
  const task = { name: t.name, project: project.id, section: t.section, collaborators: [], completed: !!t.completed, fields: t.fields ?? {}, subtasks: [], comments: [], alsoIn: [] };
  const lists = c.automations
    .filter((a) => a.automation.project === project.id)
    .flatMap((a) => [{ when: [], actions: a.automation.actions }, ...(a.automation.paths ?? [])])
    .flatMap((p) => p.actions.filter((x) => x.type === 'subtasks' && x.items.length === t.subtasks).map((x) => ({ x, fits: p.when.every((w) => test(w, task)) })));
  const best = lists.find((l) => l.fits) ?? lists[0];
  return best ? best.x.items.map((s) => s.name) : Array.from({ length: t.subtasks }, (_, i) => `Step ${i + 1}`);
}

function plain(c, key) {
  const p = c.org.team.find((m) => m.key === key);
  return p ? `${p.name}, ${p.role}` : key;
}

async function seedCase(c, ctx) {
  console.log(`\n${c.org.name}`);
  const people = (k) => plain(c, k);

  // A team per case keeps the three organizations apart in the sidebar.
  let team = ctx.defaultTeam;
  if (ctx.isOrg) {
    const teamName = `${c.org.name} (demo)`;
    team = ctx.teams.find((t) => t.name === teamName)?.gid ?? (await api('POST', '/teams', { organization: workspaceGid, name: teamName, description: c.org.disclaimer })).gid;
    console.log(`  team ${teamName}`);
  }

  // Custom fields: reuse one with the same name and type, adding any missing options.
  const fieldGids = {};
  const optionGids = {};
  for (const f of c.fields) {
    const subtype = subtypeOf[f.type];
    if (!subtype) continue;
    let existing = ctx.fields.find((x) => x.name === f.name && x.resource_subtype === subtype);
    const name = existing || !ctx.fields.some((x) => x.name === f.name) ? f.name : `${f.name} (demo)`;
    existing ??= ctx.fields.find((x) => x.name === name && x.resource_subtype === subtype);
    if (!existing) {
      existing = await api('POST', '/custom_fields', {
        workspace: workspaceGid,
        name,
        resource_subtype: subtype,
        description: f.note,
        ...(subtype === 'number' ? { precision: 0 } : {}),
        ...(f.options ? { enum_options: f.options.map((o) => ({ name: o })) } : {}),
      });
      existing = { ...existing, name, resource_subtype: subtype, enum_options: existing.enum_options ?? f.options?.map((o, i) => ({ gid: `dry-opt-${f.key}-${i}`, name: o })) ?? [] };
      ctx.fields.push(existing);
      console.log(`  field ${name}`);
    }
    existing.enum_options ??= [];
    for (const o of f.options ?? []) {
      if (existing.enum_options.some((x) => x.name === o)) continue;
      existing.enum_options.push(await api('POST', `/custom_fields/${existing.gid}/enum_options`, { name: o }));
    }
    fieldGids[f.key] = existing.gid;
    optionGids[f.key] = Object.fromEntries(existing.enum_options.map((x) => [x.name, x.gid]));
  }
  const fieldValue = (key, v) => {
    const f = c.fields.find((x) => x.key === key);
    if (!f || !fieldGids[key]) return undefined;
    if (f.type === 'single-select') return optionGids[key][v];
    if (f.type === 'multi-select') return [optionGids[key][v]];
    if (f.type === 'number') return Number(v);
    if (f.type === 'date') return { date: String(v) };
    if (f.type === 'text') return String(v);
    return undefined;
  };

  const existingProjects = await list(`/projects?workspace=${workspaceGid}${team ? `&team=${team}` : ''}&opt_fields=name`);
  const projectGids = {};
  const taskGids = {};
  const deps = [];
  for (const [i, p] of c.projects.entries()) {
    const found = existingProjects.find((x) => x.name === p.name);
    if (found) {
      projectGids[p.id] = found.gid;
      console.log(`  project ${p.name}: already there, skipped`);
      continue;
    }
    const proj = await api('POST', '/projects', {
      workspace: workspaceGid,
      ...(team ? { team } : {}),
      name: p.name,
      notes: `${p.purpose}${p.template ? `\n\n${p.template}` : ''}\n\n${c.org.disclaimer}`,
      default_view: viewOf[p.defaultView] ?? 'list',
      color: colors[(ctx.n + i) % colors.length],
    });
    projectGids[p.id] = proj.gid;
    console.log(`  project ${p.name} (${p.tasks.length} tasks)`);

    // Sections: a new project starts with one untitled section; it becomes the first.
    const sections = {};
    const start = (await list(`/projects/${proj.gid}/sections?opt_fields=name`))[0];
    for (const [j, s] of p.sections.entries()) {
      sections[s] = j === 0 && start ? (await api('PUT', `/sections/${start.gid}`, { name: s })).gid : (await api('POST', `/projects/${proj.gid}/sections`, { name: s })).gid;
    }
    for (const key of p.fields) if (fieldGids[key]) await api('POST', `/projects/${proj.gid}/addCustomFieldSetting`, { custom_field: fieldGids[key], is_important: true });

    for (const t of p.tasks) {
      const custom = {};
      for (const [k, v] of Object.entries(t.fields ?? {})) if (p.fields.includes(k) && fieldValue(k, v) !== undefined) custom[fieldGids[k]] = fieldValue(k, v);
      if (t.effort && p.fields.includes('Effort') && fieldGids.Effort) custom[fieldGids.Effort] = t.effort;
      const task = await api('POST', '/tasks', {
        name: t.name,
        projects: [proj.gid],
        resource_subtype: t.milestone ? 'milestone' : t.approval ? 'approval' : 'default_task',
        ...(t.approval ? { approval_status: t.approval } : {}),
        ...(t.completed && !t.approval ? { completed: true } : {}),
        ...(t.due !== undefined ? { due_on: dateOf(t.due) } : {}),
        ...(t.start !== undefined && t.due !== undefined && t.start < t.due && !t.milestone ? { start_on: dateOf(t.start) } : {}),
        ...(t.assignee && assignToMe ? { assignee: 'me' } : {}),
        notes: t.assignee ? `Owner in the case study: ${people(t.assignee)}.` : '',
        custom_fields: custom,
      });
      taskGids[t.name] = task.gid;
      if (sections[t.section]) await api('POST', `/sections/${sections[t.section]}/addTask`, { task: task.gid });
      if (t.subtasks) for (const name of subtaskNames(c, p, t)) await api('POST', `/tasks/${task.gid}/subtasks`, { name });
      if (t.blockedBy?.length) deps.push({ task: t.name, on: t.blockedBy });
    }
  }

  // Dependencies last: some cross projects.
  for (const d of deps) {
    const on = d.on.map((n) => taskGids[n]).filter(Boolean);
    if (on.length) await tryApi(`dependencies for ${d.task}`, () => api('POST', `/tasks/${taskGids[d.task]}/addDependencies`, { dependencies: on }));
  }

  // A status update on every project; the case's full update where it belongs.
  const s = c.status;
  const fullText = `${s.summary}\n\n${s.sections.map((x) => `${x.heading}\n${x.items.map((i) => `• ${i}`).join('\n')}`).join('\n\n')}`;
  for (const p of c.projects) {
    if (!projectGids[p.id] || existingProjects.some((x) => x.name === p.name)) continue;
    const mine = s.title.includes(p.name);
    await tryApi(`status update on ${p.name}`, () =>
      api('POST', '/status_updates', { parent: projectGids[p.id], status_type: statusType[mine ? s.status : p.status], title: mine ? s.title : `${p.name} · weekly status`, text: mine ? fullText : `${p.purpose} Owner: ${people(p.owner)}.` }),
    );
  }

  // The portfolio, with every project in it.
  const portfolio = ctx.portfolios.find((x) => x.name === c.portfolio.name) ?? (await tryApi('portfolio', async () => {
    const pf = await api('POST', '/portfolios', { workspace: workspaceGid, name: c.portfolio.name, color: colors[ctx.n % colors.length] });
    for (const p of c.projects) if (projectGids[p.id]) await api('POST', `/portfolios/${pf.gid}/addItem`, { item: projectGids[p.id] });
    if (s.title.includes(c.portfolio.name)) await api('POST', '/status_updates', { parent: pf.gid, status_type: statusType[s.status], title: s.title, text: fullText });
    console.log(`  portfolio ${c.portfolio.name}`);
    return pf;
  }));

  // Goals: the company goal, its team goals, progress as a percentage, and linked projects.
  const makeGoal = async (g) => {
    if (ctx.goals.some((x) => x.name === g.name)) {
      console.log(`  goal ${g.name}: already there, skipped`);
      return undefined;
    }
    const goal = await api('POST', '/goals', { workspace: workspaceGid, ...(team && ctx.isOrg ? { team } : {}), ...(ctx.period ? { time_period: ctx.period } : {}), name: g.name, notes: `${g.measure}. Owner in the case study: ${people(g.owner)}. Period: ${g.period}.`, ...(assignToMe ? { owner: ctx.me } : {}) });
    await api('POST', `/goals/${goal.gid}/setMetric`, { precision: 0, unit: 'percentage', initial_number_value: 0, target_number_value: 1, current_number_value: g.progress / 100, progress_source: 'manual' });
    await api('PUT', `/goals/${goal.gid}`, { status: goalStatus[g.status] });
    const linked = g.measure.match(/^Linked (project|portfolio): (.+)$/);
    if (linked) {
      const gid = linked[1] === 'portfolio' ? portfolio?.gid : projectGids[c.projects.find((p) => p.name === linked[2])?.id];
      if (gid) await tryApi(`link ${linked[2]} to a goal`, () => api('POST', `/goals/${goal.gid}/addSupportingRelationship`, { supporting_resource: gid }));
    }
    for (const child of g.children ?? []) {
      const sub = await tryApi(`goal ${child.name}`, () => makeGoal(child));
      if (sub) await tryApi('subgoal link', () => api('POST', `/goals/${goal.gid}/addSupportingRelationship`, { supporting_resource: sub.gid }));
    }
    return goal;
  };
  for (const g of c.goals) if (await tryApi(`goal ${g.name}`, () => makeGoal(g))) console.log(`  goals (${1 + (g.children?.length ?? 0)})`);
}

/* ---------- Run ---------- */

buildSheet();
if (dry) {
  for (const c of cases) {
    console.log(`\n${c.org.name}: ${c.fields.length} fields, ${c.projects.length} projects, ${c.projects.reduce((n, p) => n + p.tasks.length, 0)} tasks, ${c.projects.reduce((n, p) => n + p.tasks.reduce((m, t) => m + (t.subtasks ?? 0), 0), 0)} subtasks, 1 portfolio, ${c.goals.reduce((n, g) => n + 1 + (g.children?.length ?? 0), 0)} goals`);
    for (const p of c.projects) for (const t of p.tasks) if (t.subtasks) console.log(`  ${t.name}: ${subtaskNames(c, p, t).join(' · ')}`);
  }
  // Walk the real seeding code with the API stubbed, so the plan is exactly what a run would send.
  const ctx = { me: 'me', isOrg: true, teams: [], fields: [], portfolios: [], goals: [], period: 'dry-period', n: 0 };
  for (const c of cases) {
    await seedCase(c, ctx);
    ctx.n += 3;
  }
  writeFileSync('asana-seed-output/dry-run.log', dryLog.join('\n') + '\n');
  console.log(`\nDry run: nothing was sent. ${calls} API calls written to asana-seed-output/dry-run.log. Dates would start on Monday ${dateOf(0)}.`);
  process.exit(0);
}
if (!token) {
  console.error('Set ASANA_TOKEN to a personal access token (Asana › My settings › Apps › Developer apps). Use --dry-run to see the plan without one.');
  process.exit(1);
}
const me = await api('GET', '/users/me?opt_fields=name,workspaces.name,workspaces.is_organization');
if (!workspaceGid) {
  console.log(`Signed in as ${me.name}. Pick a workspace and run again with ASANA_WORKSPACE=<gid>:`);
  for (const w of me.workspaces) console.log(`  ${w.gid}  ${w.name}${w.is_organization ? ' (organization)' : ''}`);
  console.log('\nUse a trial or sandbox workspace: this creates about 70 tasks, 3 portfolios and 12 goals.');
  process.exit(0);
}
const ws = me.workspaces.find((w) => w.gid === workspaceGid);
if (!ws) {
  console.error(`Workspace ${workspaceGid} isn’t one of yours. Run without ASANA_WORKSPACE to list them.`);
  process.exit(1);
}
console.log(`Seeding ${cases.map((c) => c.org.name).join(', ')} into “${ws.name}” as ${me.name}. Dates start on Monday ${dateOf(0)}.`);
const ctx = {
  me: me.gid,
  isOrg: ws.is_organization,
  teams: ws.is_organization ? await list(`/organizations/${workspaceGid}/teams?opt_fields=name`) : [],
  defaultTeam: undefined,
  fields: await list(`/workspaces/${workspaceGid}/custom_fields?opt_fields=name,resource_subtype,enum_options.name`),
  portfolios: await list(`/portfolios?workspace=${workspaceGid}&owner=me&opt_fields=name`),
  goals: await list(`/goals?workspace=${workspaceGid}&opt_fields=name`),
  // Goals need a time period: the shortest one (a quarter, usually) that contains today.
  period: (await list(`/time_periods?workspace=${workspaceGid}&opt_fields=display_name,period,start_on,end_on`))
    .filter((t) => t.start_on <= new Date().toISOString().slice(0, 10) && t.end_on >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.end_on.localeCompare(b.end_on))[0]?.gid,
  n: 0,
};
for (const c of cases) {
  await seedCase(c, ctx);
  ctx.n += 3;
}
console.log(`\nDone in ${calls} API calls. Next: build the forms and automations from asana-seed-output/build-sheet.md.`);

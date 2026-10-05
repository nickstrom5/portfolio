/**
 * Browser side of /ghl/: plays a simulated run step by step, marks the path
 * on the canvas, keeps the contact record in sync and writes the log.
 */
import { simulate, startContact, formatClock, formatDay, formatTime, formatDuration, type Trace, type TraceStep } from './engine';
import type { Automation, CaseStudy, Contact, Scenario, ScenarioEvent } from './types';

/** What a simulator needs from its case study: the sample contact, merge env and field labels. */
export interface SimEnv {
  automations: Automation[];
  contact: Contact;
  env: Parameters<typeof simulate>[3];
  /** Custom-field keys to show on the record, with display names. */
  fieldLabels: Record<string, string>;
}

export function envFor(study: CaseStudy): SimEnv {
  return { automations: study.automations, contact: study.business.sampleContact, env: study.business.env, fieldLabels: study.business.fieldLabels };
}

const STEP_MS = 520;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** GHL lists a contact with no name by their phone number, then email. */
function displayName(c: Contact) {
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.phone || c.email || 'Unnamed contact';
}

function initials(c: Contact) {
  return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase() || '#';
}

export class Simulator {
  private root: HTMLElement;
  private canvas: HTMLElement | null;
  private auto: Automation;
  private env: SimEnv;
  private log: HTMLOListElement;
  private clock: HTMLElement;
  private elapsed: HTMLElement;
  private record: HTMLElement;
  private outcome: HTMLElement;
  private runBtn: HTMLButtonElement;
  private announce: HTMLElement | null;
  private recDot: HTMLElement | null;
  private timer: number | undefined;
  private override: Partial<Contact> | undefined;
  /** One-off start time and events, used by the landing-page demo. */
  private timing: { start: number; events: ScenarioEvent[] } | undefined;
  private prev: Contact | undefined;
  private lastDay = -1;

  constructor(root: HTMLElement, env: SimEnv) {
    this.root = root;
    this.env = env;
    const id = root.dataset.sim!;
    this.auto = env.automations.find((a) => a.id === id)!;
    this.canvas = document.querySelector<HTMLElement>(`[data-canvas="${root.dataset.case}:${id}"]`);
    this.log = root.querySelector('[data-log]')!;
    this.clock = root.querySelector('[data-clock]')!;
    this.elapsed = root.querySelector('[data-elapsed]')!;
    this.record = root.querySelector('[data-record]')!;
    this.outcome = root.querySelector('[data-outcome]')!;
    this.runBtn = root.querySelector('[data-run]')!;
    this.announce = root.querySelector('[data-announce]');
    this.recDot = root.querySelector('[data-rec-dot]');

    // Execution log / contact record tabs.
    const views = [...root.querySelectorAll<HTMLButtonElement>('[data-view]')];
    const show = (v: string, focus: boolean) => {
      views.forEach((b) => {
        const on = b.dataset.view === v;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      root.querySelectorAll<HTMLElement>('[data-view-panel]').forEach((p) => (p.hidden = p.dataset.viewPanel !== v));
      if (v === 'record' && this.recDot) this.recDot.hidden = true;
    };
    views.forEach((b, i) => {
      b.addEventListener('click', () => show(b.dataset.view!, false));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        show(views[(i + 1) % views.length].dataset.view!, true);
      });
    });

    this.runBtn.addEventListener('click', () => {
      this.run(false);
      this.showScreen();
    });
    root.querySelector('[data-instant]')?.addEventListener('click', () => {
      this.run(true);
      this.showScreen();
    });
    root.querySelector('[data-reset]')?.addEventListener('click', () => this.reset());
    root.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((r) =>
      // A sample contact runs as described, so the visitor's form details and timing go.
      r.addEventListener('change', () => this.useContact(undefined)),
    );
    root.querySelector('[data-clear-override]')?.addEventListener('click', () => {
      this.useContact(undefined);
      this.runBtn.focus();
    });
    this.reset();
  }

  /** Starts an animated run after a delay; any reset or new run cancels it. */
  runLater(ms: number) {
    this.stop();
    if (ms <= 0) return this.run(false);
    this.timer = window.setTimeout(() => this.run(false), ms);
  }

  /** The execution log, for moving focus to it after scrolling here. */
  get logElement() {
    return this.log;
  }

  get scenario(): Scenario {
    const checked = this.root.querySelector<HTMLInputElement>('input[type=radio]:checked');
    const s = this.auto.scenarios.find((x) => x.id === checked?.value) ?? this.auto.scenarios[0];
    return this.timing ? { ...s, ...this.timing } : s;
  }

  selectScenario(id: string) {
    const input = this.root.querySelector<HTMLInputElement>(`input[type=radio][value="${id}"]`);
    if (input) input.checked = true;
  }

  /** Runs with a contact built from the landing-page form instead of the sample. */
  useContact(c: Partial<Contact> | undefined, timing?: { start: number; events: ScenarioEvent[] }) {
    this.override = c;
    this.timing = c ? timing : undefined;
    const note = this.root.querySelector<HTMLElement>('[data-override]');
    if (note) {
      note.hidden = !c;
      const name = note.querySelector('[data-override-name]');
      if (name && c) name.textContent = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    }
    this.reset();
  }

  private stop() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.root.classList.remove('is-running');
  }

  reset() {
    this.stop();
    this.log.replaceChildren(el('li', 'g-log-empty', 'Pick a sample customer above, then press Run workflow. Each line is one step, with the time it would happen: blue bubbles are texts, boxes are emails, and notes marked To: or Slack go to the team. Days of waiting are fast-forwarded.'));
    const s = this.scenario;
    this.clock.textContent = formatClock(s.start);
    this.elapsed.textContent = 'Not started';
    this.outcome.hidden = true;
    this.lastDay = -1;
    this.prev = undefined;
    this.renderRecord(startContact(this.env.contact, s, this.override), false);
    this.clearCanvas();
    if (this.recDot) this.recDot.hidden = true;
    if (this.announce) this.announce.textContent = '';
  }

  /** On one-column layouts the log sits below the controls: bring it up so Run visibly does something. */
  private showScreen() {
    if (!window.matchMedia('(max-width: 960px)').matches) return;
    const screen = this.root.querySelector<HTMLElement>('.g-screen');
    if (screen && screen.getBoundingClientRect().top > window.innerHeight * 0.55) {
      screen.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  private clearCanvas() {
    if (!this.canvas) return;
    const body = this.canvas.querySelector<HTMLElement>('.g-canvas-body');
    if (body) body.scrollTop = 0;
    this.canvas.classList.remove('is-running', 'is-ran');
    this.canvas.querySelectorAll('.is-done, .is-active, .is-skipped, .is-taken, .is-dim').forEach((n) => n.classList.remove('is-done', 'is-active', 'is-skipped', 'is-taken', 'is-dim'));
  }

  run(instant: boolean) {
    this.stop();
    this.reset();
    const trace = simulate(this.auto, this.scenario, this.env.contact, this.env.env, this.override);
    this.log.replaceChildren();
    this.canvas?.classList.add('is-running');
    this.root.classList.add('is-running');
    if (this.announce) this.announce.textContent = `Running ${this.auto.name}: ${this.scenario.label}.`;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduce) {
      trace.steps.forEach((s, i) => this.apply(s, trace, i === trace.steps.length - 1, false));
      this.finish(trace);
      return;
    }
    let i = 0;
    const tick = () => {
      const s = trace.steps[i];
      this.apply(s, trace, i === trace.steps.length - 1, true);
      i++;
      if (i < trace.steps.length) this.timer = window.setTimeout(tick, s.kind === 'wait' || s.kind === 'hold' ? STEP_MS * 1.4 : STEP_MS);
      else this.finish(trace);
    };
    tick();
  }

  private apply(step: TraceStep, trace: Trace, _last: boolean, animate: boolean) {
    // Day separator.
    const day = Math.floor(step.t / 1440);
    if (day !== this.lastDay) {
      this.log.append(el('li', 'g-day', formatDay(step.t)));
      this.lastDay = day;
    }
    const li = el('li', `g-li k-${step.kind}`);
    const time = el('time', undefined, formatTime(step.t));
    const body = el('div');
    const title = el('span', 'g-li-title', step.title);
    body.append(title);
    if (step.detail) body.append(el('span', 'g-li-detail', step.detail));
    if (step.message) body.append(this.renderMessage(step.message));
    li.append(time, body);
    this.log.append(li);
    this.log.scrollTop = this.log.scrollHeight;

    this.clock.textContent = formatClock(step.t);
    this.elapsed.textContent = step.t === trace.start ? 'Start' : `+${formatDuration(step.t - trace.start)}`;
    this.renderRecord(step.contact, animate);
    this.markCanvas(step);
  }

  private renderMessage(m: NonNullable<TraceStep['message']>): HTMLElement {
    if (m.channel === 'sms') {
      const b = el('div', `g-bubble ${m.direction}`, m.body);
      return b;
    }
    if (m.channel === 'email') {
      const box = el('div', `g-mail${m.direction === 'in' ? ' in' : ''}`);
      if (m.direction === 'in') box.append(el('span', 'g-note-to', 'Email reply'));
      if (m.subject) box.append(el('span', 'g-mail-subj', m.subject));
      box.append(document.createTextNode(m.body));
      return box;
    }
    const box = el('div', 'g-note');
    const label = m.channel === 'slack' ? `Slack${m.to ? ` · ${m.to}` : ''}` : m.channel === 'voicemail' ? 'Ringless voicemail' : `To: ${m.to ?? 'Assigned user'}`;
    box.append(el('span', 'g-note-to', label));
    if (m.subject) box.append(el('span', 'g-mail-subj', m.subject));
    box.append(document.createTextNode(m.body));
    return box;
  }

  private markCanvas(step: TraceStep) {
    const c = this.canvas;
    if (!c) return;
    c.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    if (step.kind === 'trigger') c.querySelector('.g-triggers')?.classList.add('is-done');
    if (!step.nodeId) return;
    const node = c.querySelector<HTMLElement>(`[data-node="${step.nodeId}"]`);
    if (!node) return;
    if (step.kind === 'skip') node.classList.add('is-skipped');
    else if (step.kind !== 'hold') node.classList.add('is-done');
    node.classList.add('is-active');
    // The diagram is capped to one screen: scroll it, never the page, so the active step stays in view.
    const body = c.querySelector<HTMLElement>('.g-canvas-body');
    if (body && body.scrollHeight > body.clientHeight + 4) {
      const top = node.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - body.clientHeight / 3;
      body.scrollTo({ top: Math.max(0, top), behavior: c.classList.contains('is-running') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
    }
    if (step.branch) {
      const branch = c.querySelector<HTMLElement>(`[data-branch="${step.branch}"]`);
      if (!branch) return;
      branch.classList.add('is-taken');
      branch.classList.remove('is-dim');
      // A Go To can come back through a split: never dim a branch that has run.
      branch.parentElement?.querySelectorAll<HTMLElement>(':scope > .g-branch').forEach((b) => {
        if (b !== branch && !b.classList.contains('is-taken')) b.classList.add('is-dim');
      });
    }
  }

  private finish(trace: Trace) {
    this.stop();
    this.canvas?.classList.remove('is-running');
    this.canvas?.classList.add('is-ran');
    this.canvas?.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    const sent = trace.steps.filter((s) => s.message && s.message.direction === 'out' && (s.message.channel === 'sms' || s.message.channel === 'email')).length;
    const skipped = trace.skipped.length;
    // Name what actually ended the run: a removal by another workflow, an End step, a goal…
    const last = [...trace.steps].reverse().find((s) => s.kind === 'stop' || s.kind === 'end');
    const label =
      trace.outcome === 'completed' ? 'Workflow complete' : trace.outcome === 'goal' ? 'Goal reached, workflow complete' : trace.outcome === 'stopped' ? 'Stopped on reply' : (last?.title ?? 'Ended');
    const opp = trace.contact.opportunity;
    const parts = [
      `${sent} message${sent === 1 ? '' : 's'} to the contact ${trace.end > trace.start ? `over ${formatDuration(trace.end - trace.start)}` : 'in under a minute'}`,
      skipped ? `${skipped} step${skipped === 1 ? '' : 's'} skipped` : '',
      opp ? `opportunity in ${opp.stage} (${opp.status})` : '',
    ].filter(Boolean);
    const plain = el('span', 'g-outcome-plain');
    plain.append(el('strong', undefined, 'What happened: '), document.createTextNode(this.plain(trace, last)));
    const tech = el('span', 'g-outcome-tech');
    tech.append(el('strong', undefined, label), document.createTextNode(` · ${parts.join(' · ')}`));
    this.outcome.replaceChildren(plain, tech);
    this.outcome.hidden = false;
    // In the sticky column the result can sit below its visible edge; scroll the column, never the page.
    const col = this.root.closest<HTMLElement>('.gx-lab-sim');
    if (col) {
      const visBottom = Math.min(col.getBoundingClientRect().bottom, window.innerHeight);
      const over = this.outcome.getBoundingClientRect().bottom - visBottom;
      if (over > 0) col.scrollTop += over + 8;
    }
    if (this.announce) this.announce.textContent = `${this.plain(trace, last)} ${label}.`;
  }

  /** The run in one or two plain sentences, for readers who will not read the log. */
  private plain(trace: Trace, last: TraceStep | undefined): string {
    const who = trace.contact.firstName || 'The customer';
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    const out = trace.steps.filter((s) => s.message?.direction === 'out');
    const count = (...ch: string[]) => out.filter((s) => ch.includes(s.message!.channel)).length;
    const toContact = out.filter((s) => s.message!.channel === 'sms' || s.message!.channel === 'email' || s.message!.channel === 'voicemail');
    const got = [
      count('email') && n(count('email'), 'email', 'emails'),
      count('sms') && n(count('sms'), 'text', 'texts'),
      count('voicemail') && n(count('voicemail'), 'voicemail', 'voicemails'),
    ].filter(Boolean) as string[];
    const lastSent = toContact.length ? toContact[toContact.length - 1].t - trace.start : 0;
    const team = count('internal', 'slack');
    const goal = trace.steps.find((s) => s.kind === 'goal' && s.title.startsWith('Goal met: '));
    const stopAt = last ? trace.steps.lastIndexOf(last) : -1;
    const exitEvent = stopAt > 0 ? trace.steps.slice(0, stopAt).reverse().find((s) => s.kind === 'event') : undefined;
    const status: Record<string, string> = { open: 'still open', won: 'marked won', lost: 'marked lost', abandoned: 'closed as gone quiet (Abandoned)' };
    const ending =
      trace.outcome === 'stopped'
        ? `${who} replied, so the automatic messages stopped and a person takes it from here.`
        : trace.outcome === 'goal'
          ? `Its goal was met${goal ? ` (${goal.title.replace(/^Goal met: /, '')})` : ''}, so it ${goal?.detail?.includes('skips straight here') ? 'skipped the remaining follow-up and finished' : 'finished'}.`
          : trace.outcome === 'completed'
            ? 'The workflow ran to the end.'
            : last?.title === 'Removed from this workflow'
              ? exitEvent
                ? `After “${exitEvent.title}”, another workflow took over and took ${trace.contact.firstName || 'them'} out of this one.`
                : `${who} left this workflow early because another workflow took over. The last line of the log says which.`
              : last?.title === 'Pulled out of this run'
                ? 'The appointment was cancelled or missed, so this run ended.'
                : last?.title === 'Goal not met: End this workflow'
                  ? `${who} never did what the workflow was waiting for, so it ended as designed.`
                  : last?.title === 'Still waiting on the goal'
                    ? `${who} has not done what the workflow is waiting for yet. In GoHighLevel they would keep waiting.`
                    : last?.kind === 'end'
                      ? 'It reached an End step on this path, as designed.'
                      : 'It ended early. The last line of the log says why.';
    const opp = trace.contact.opportunity;
    return [
      got.length ? `${who} got ${got.join(' and ')} ${lastSent > 0 ? `within ${formatDuration(lastSent)}` : 'right away'}.` : `${who} got no messages from this workflow.`,
      team ? `The team got ${n(team, 'alert', 'alerts')}.` : '',
      trace.steps.some((s) => s.kind === 'hold') ? 'Some steps waited for the allowed sending hours.' : '',
      ending,
      opp ? `The deal card is at ${opp.stage}, ${status[opp.status] ?? opp.status}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private renderRecord(c: Contact, animate: boolean) {
    const prev = this.prev;
    const changed = (a: unknown, b: unknown) => animate && prev !== undefined && JSON.stringify(a) !== JSON.stringify(b);
    const head = el('div', 'g-rec-head');
    const av = el('span', 'g-avatar', initials(c));
    av.setAttribute('aria-hidden', 'true');
    const who = el('div');
    const name = displayName(c);
    who.append(el('strong', undefined, name), el('span', undefined, [c.phone, c.email].filter((v) => v && v !== name).join(' · ')));
    head.append(av, who);

    const grid = el('dl', 'g-rec-grid');
    const row = (label: string, value: string, was: unknown, now: unknown) => {
      const d = el('div');
      const dd = el('dd', undefined, value);
      if (changed(was, now)) {
        if (this.recDot) this.recDot.hidden = !this.record.parentElement?.hidden;
        dd.classList.add('is-new');
        window.setTimeout(() => dd.classList.remove('is-new'), 900);
      }
      d.append(el('dt', undefined, label), dd);
      grid.append(d);
    };
    const opp = c.opportunity;
    row('Pipeline stage', opp ? `${opp.stage}${opp.status !== 'open' ? ` · ${opp.status}` : ''}` : 'No opportunity', prev?.opportunity, opp);
    row('Assigned to', c.assignedTo ? (this.env.env.users[c.assignedTo]?.name ?? c.assignedTo) : 'Unassigned', prev?.assignedTo, c.assignedTo);
    const dnd = Object.entries(c.dnd).filter(([, v]) => v).map(([k]) => ({ sms: 'texts', email: 'email', calls: 'calls' })[k] ?? k);
    row('Do not disturb (DND)', dnd.length ? `On for ${dnd.join(', ')}` : 'Off', prev?.dnd, c.dnd);
    for (const [key, label] of Object.entries(this.env.fieldLabels)) {
      if (c.fields[key] === undefined || c.fields[key] === '') continue;
      row(label, String(c.fields[key]), prev?.fields[key], c.fields[key]);
    }

    const tagsTitle = el('p', 'g-rec-title', 'Tags');
    const tags = el('ul', 'g-rec-tags');
    if (!c.tags.length) tags.append(el('li', 'g-none', 'No tags yet'));
    for (const tag of c.tags) {
      const li = el('li', undefined, tag);
      if (animate && prev && !prev.tags.includes(tag)) {
        if (this.recDot) this.recDot.hidden = !this.record.parentElement?.hidden;
        li.classList.add('is-new');
        window.setTimeout(() => li.classList.remove('is-new'), 900);
      }
      tags.append(li);
    }
    this.record.replaceChildren(head, grid, tagsTitle, tags);
    this.prev = JSON.parse(JSON.stringify(c));
  }
}

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

function initials(c: Contact) {
  return `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase() || '?';
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

    this.runBtn.addEventListener('click', () => this.run(false));
    root.querySelector('[data-instant]')?.addEventListener('click', () => this.run(true));
    root.querySelector('[data-reset]')?.addEventListener('click', () => this.reset());
    root.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((r) =>
      r.addEventListener('change', () => {
        this.timing = undefined;
        this.reset();
      }),
    );
    root.querySelector('[data-clear-override]')?.addEventListener('click', () => this.useContact(undefined));
    this.reset();
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
    this.log.replaceChildren(el('li', 'g-log-empty', 'Pick a test contact, then run the workflow. Waits are fast-forwarded; every step keeps its real timestamp.'));
    const s = this.scenario;
    this.clock.textContent = formatClock(s.start);
    this.elapsed.textContent = 'Not started';
    this.outcome.hidden = true;
    this.lastDay = -1;
    this.prev = undefined;
    this.renderRecord(startContact(this.env.contact, s, this.override), false);
    this.clearCanvas();
    this.runBtn.disabled = false;
  }

  private clearCanvas() {
    if (!this.canvas) return;
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
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduce) {
      trace.steps.forEach((s, i) => this.apply(s, trace, i === trace.steps.length - 1, false));
      this.finish(trace);
      return;
    }
    this.runBtn.disabled = true;
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
      const box = el('div', 'g-mail');
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
    if (step.branch) {
      const branch = c.querySelector<HTMLElement>(`[data-branch="${step.branch}"]`);
      branch?.classList.add('is-taken');
      branch?.parentElement?.querySelectorAll<HTMLElement>(':scope > .g-branch').forEach((b) => {
        if (b !== branch) b.classList.add('is-dim');
      });
    }
  }

  private finish(trace: Trace) {
    this.stop();
    this.runBtn.disabled = false;
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
      `${sent} message${sent === 1 ? '' : 's'} to the contact over ${formatDuration(trace.end - trace.start) || 'under a minute'}`,
      skipped ? `${skipped} step${skipped === 1 ? '' : 's'} skipped` : '',
      opp ? `opportunity in ${opp.stage} (${opp.status})` : '',
    ].filter(Boolean);
    this.outcome.replaceChildren(el('strong', undefined, label), document.createTextNode(parts.join(' · ')));
    this.outcome.hidden = false;
  }

  private renderRecord(c: Contact, animate: boolean) {
    const prev = this.prev;
    const changed = (a: unknown, b: unknown) => animate && prev !== undefined && JSON.stringify(a) !== JSON.stringify(b);
    const head = el('div', 'g-rec-head');
    const av = el('span', 'g-avatar', initials(c));
    av.setAttribute('aria-hidden', 'true');
    const who = el('div');
    who.append(el('strong', undefined, `${c.firstName} ${c.lastName}`.trim()), el('span', undefined, [c.phone, c.email].filter(Boolean).join(' · ')));
    head.append(av, who);

    const grid = el('dl', 'g-rec-grid');
    const row = (label: string, value: string, was: unknown, now: unknown) => {
      const d = el('div');
      const dd = el('dd', undefined, value);
      if (changed(was, now)) {
        dd.classList.add('is-new');
        window.setTimeout(() => dd.classList.remove('is-new'), 900);
      }
      d.append(el('dt', undefined, label), dd);
      grid.append(d);
    };
    const opp = c.opportunity;
    row('Pipeline stage', opp ? `${opp.stage}${opp.status !== 'open' ? ` · ${opp.status}` : ''}` : 'No opportunity', prev?.opportunity, opp);
    row('Assigned to', c.assignedTo ? (this.env.env.users[c.assignedTo]?.name ?? c.assignedTo) : 'Unassigned', prev?.assignedTo, c.assignedTo);
    const dnd = Object.entries(c.dnd).filter(([, v]) => v).map(([k]) => k.toUpperCase());
    row('DND', dnd.length ? dnd.join(', ') : 'Off', prev?.dnd, c.dnd);
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
        li.classList.add('is-new');
        window.setTimeout(() => li.classList.remove('is-new'), 900);
      }
      tags.append(li);
    }
    const title = el('p', 'g-rec-title', 'Contact record');
    this.record.replaceChildren(title, head, grid, tagsTitle, tags);
    this.prev = JSON.parse(JSON.stringify(c));
  }
}

import type { Content } from '../content/load';
import type { EncounterKind, Look, Skill, WantId, Zone } from '../content/schema';
import { chance, clamp, makeRng, pick, type Rng } from './rng';
import { Text, type Vars } from './text';

// ---------- types ----------
export type Tier = 'nailed' | 'fine' | 'backfire' | 'chaos';
export type Stage = 'sober' | 'tipsy' | 'wasted';
export type Place = 'floor' | 'table' | 'simon' | 'anders' | 'bush';

export interface Want { type: WantId; level: number; born: number; stranger?: string; text: string; heavy?: boolean }
export interface Friend {
  id: string; name: string; traits: [string, string]; look: Look; stranger: false;
  drunk: number; joy: number; zone: Zone; want: Want | null; busy: number; gone: string | null; goneKey?: string; home?: string;
  outUntil: number; returnZone?: Zone; flip: number; tolMul: number; crush: string | null;
  danced: boolean; flipped: boolean; ko: boolean; offDuty: boolean;
}
export interface Stranger {
  id: string; def: string; kind: EncounterKind | null; name: string; tag: string; trait: string; look: Look;
  stranger: true; zone: Zone; left: boolean;
}
export type Person = Friend | Stranger;
export interface Fx { id: string; text: string; tier: Tier | 'flip' | 'magic' }
export interface LogEntry { t: number; clock: string; text: string; math?: string }
export interface ChatLine { from: string; text: string }
export interface Story { t: number; weight: number; ids: string[]; lines: ChatLine[]; photo?: string }
export interface CrewMember { name: string; traits: [string, string]; look: Look }
export interface Recap {
  night: number;
  msgs: { from: string; name: string; text?: string; photo?: string; ids?: string[] }[];
  changes: string[];
  home: { name: string; how: string }[];
}
export interface State {
  t: number; len: number; night: number; seed: number; bonds: Record<string, number>; bondStart: Record<string, number>;
  friends: Friend[]; strangers: Stranger[]; anders: number; bushEmpty: boolean; tonight: EncounterKind[];
  remix: { at: number; state: 'waiting' | 'teasing' | 'playing' | 'done'; until: number };
  stories: Story[]; fx: Fx[]; log: LogEntry[]; nextId: number; nextStranger: number; lastRoundWar: number;
  lastSpawn: number; ended: boolean; pending: { at: number; id: string; type: WantId; key: string; vars: Vars }[];
}
export interface Carry { night: number; bonds: Record<string, number> }

/**
 * One night at Zwei Grosse Bier Bar.
 * Pure logic: no DOM, no Phaser, no Math.random. All text comes from content/text via `this.tx`.
 */
export class Sim {
  readonly rng: Rng;
  readonly tx: Text;
  readonly c: Content;
  readonly lang: string;
  s!: State;

  constructor(content: Content, seed: number, opts: { lang?: string; strictText?: boolean } = {}) {
    this.c = content;
    this.lang = opts.lang ?? 'da';
    this.rng = makeRng(seed);
    this.tx = new Text(content.text[this.lang], this.rng, !!opts.strictText);
    this.seed = seed;
  }
  private seed: number;

  // ---------- small helpers ----------
  private t(key: string, vars?: Vars) { return this.tx.t(key, vars); }
  private get T() { return this.c.tuning; }
  private pick<T>(a: readonly T[]) { return pick(this.rng, a); }
  private chance(p: number) { return chance(this.rng, p); }

  person(id: string): Person | undefined { return this.s.friends.find(f => f.id === id) ?? this.s.strangers.find(x => x.id === id); }
  friend(id: string) { return this.s.friends.find(f => f.id === id); }
  active(f: Friend) { return f.drunk >= f.flip ? f.traits[1] : f.traits[0]; }
  traitName(id: string) { return this.t(`trait.${id}.name`); }
  activeName(f: Friend) { return this.traitName(this.active(f)); }
  stage(f: Friend): Stage { return f.drunk < f.flip ? 'sober' : f.drunk < this.T.wastedAt ? 'tipsy' : 'wasted'; }
  isHere(f: Friend) { return !f.gone && f.zone !== 'out'; }
  avail(f: Friend) { return this.isHere(f) && this.s.t >= f.busy; }
  canAct(f: Friend) { return this.avail(f) && !(f.want && (f.want.type === 'lost' || f.want.type === 'sick')); }
  here() { return this.s.friends.filter(f => this.isHere(f)); }
  withActive(trait: string, except: string[] = []) { return this.here().filter(f => this.active(f) === trait && !except.includes(f.id)); }
  bond(a: string, b: string) { return this.s.bonds[[a, b].sort().join('|')] ?? 0; }
  private addBond(a: string, b: string, v: number) { if (a === b) return; const k = [a, b].sort().join('|'); this.s.bonds[k] = clamp((this.s.bonds[k] ?? 0) + v, -4, 4); }
  private addJoy(p: Person, v: number) { if (p.stranger) return; p.joy = clamp(p.joy + v, -4, 4); }
  clock() { const m = 21 * 60 + Math.floor(this.s.t / this.s.len * 360); const h = Math.floor(m / 60) % 24; return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
  phase(): 'warm' | 'peak' | 'comedown' { const p = this.s.t / this.s.len; return p < 0.3 ? 'warm' : p < 0.75 ? 'peak' : 'comedown'; }
  liveStrangers() { return this.s.strangers.filter(x => !x.left); }
  private kindHere(kind: EncounterKind) { return this.liveStrangers().find(x => x.kind === kind); }
  private fx(id: string, text: string, tier: Fx['tier']) { this.s.fx.push({ id, text, tier }); }
  private log(text: string, math?: string) { this.s.log.push({ t: this.s.t, clock: this.clock(), text, math }); }
  private story(weight: number, ids: string[], lines: [string, string, Vars?][], photo?: [string, Vars]) {
    this.s.stories.push({ t: this.s.t, weight, ids, lines: lines.map(([from, key, v]) => ({ from, text: this.t(key, v) })), photo: photo && this.t(photo[0], photo[1]) });
  }
  drainFx() { const a = this.s.fx; this.s.fx = []; return a; }

  // ---------- setup ----------
  newNight(crew: CrewMember[], carry?: Carry) {
    const T = this.T;
    const kinds = ['creep', 'hooligan', 'racists', 'carpenter', 'gang'] as EncounterKind[];
    const shuffled = kinds.map(k => [this.rng(), k] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    this.s = {
      t: 0, len: T.nightLength, night: carry ? carry.night + 1 : 1, seed: this.seed, bonds: { ...(carry?.bonds ?? {}) }, bondStart: {},
      friends: [], strangers: [], anders: 0, bushEmpty: false,
      tonight: shuffled.slice(0, T.encounters.perNight + (this.chance(T.encounters.extraChance) ? 1 : 0)),
      remix: { at: T.nightLength * (0.45 + this.rng() * 0.18), state: 'waiting', until: 0 },
      stories: [], fx: [], log: [], nextId: 1, nextStranger: 30, lastRoundWar: 0, lastSpawn: -99, ended: false, pending: [],
    };
    const s = this.s;
    s.friends = crew.map((m, i) => ({
      id: 'f' + i, name: m.name, traits: [m.traits[0], m.traits[1]], look: m.look, stranger: false,
      drunk: 1 + this.rng() * 1.2, joy: 0.5, zone: 'table', want: null, busy: 0, gone: null, outUntil: 0,
      flip: T.flipAt, tolMul: 1, crush: null, danced: false, flipped: false, ko: false, offDuty: false,
    }));
    const mums = s.friends.filter(f => f.traits[0] === 'mum');
    mums.slice(1).forEach(m => { m.flip = T.flipAt - 1; m.tolMul = 1.5; m.offDuty = true; });
    s.friends.forEach(f => { if (f.traits.includes('jealous') && s.friends.length > 1) f.crush = this.pick(s.friends.filter(o => o.id !== f.id)).id; });
    s.bondStart = { ...s.bonds };
    const host = this.pick(s.friends);
    this.log(this.t('event.start', { n: s.night, host: host.name }));
    this.addStranger(); this.addStranger();
    if (mums.length > 1) this.log(this.t('event.mumsOffDuty', { names: mums.slice(1).map(m => m.name).join(` ${this.t('word.and')} `) }));
    s.friends.filter(f => f.crush).forEach(f => this.log(this.t('event.crush', { name: f.name, crush: this.friend(f.crush!)!.name }), 'crush'));
    return s;
  }

  // ---------- strangers ----------
  private addStranger(): Stranger | null {
    const s = this.s, p = s.t / s.len;
    const used = s.strangers.map(x => x.def);
    const defs = Object.values(this.c.strangers);
    const enc = defs.filter(d => d.kind && s.tonight.includes(d.kind) && !used.includes(d.id) && p >= (d.minProgress ?? 0));
    const normal = defs.filter(d => !d.kind && !used.includes(d.id));
    const pool = enc.length && (this.chance(0.55) || !normal.length) ? enc : normal;
    if (!pool.length) return null;
    const d = this.pick(pool);
    const x: Stranger = {
      id: 's' + s.nextId++, def: d.id, kind: d.kind ?? null, name: this.t(`stranger.${d.id}.name`), tag: this.t(`stranger.${d.id}.tag`),
      trait: d.trait, look: d.look ? { ...d.look, accessory: d.accessory } : { ...this.randomLook(true), accessory: d.accessory },
      stranger: true, zone: d.zone ?? this.pick(['floor', 'floor', 'bar', 'table'] as Zone[]), left: false,
    };
    s.strangers.push(x);
    this.log(x.kind ? this.t(`arrive.${x.kind}`) : this.t('arrive.default', { s: x.name }));
    if (x.kind === 'carpenter') {
      this.here().forEach(f => { this.addDrunk(f, 0.6); this.addJoy(f, 1); });
      const sp = this.withActive('spender')[0];
      if (sp) { this.addDrunk(sp, 0.5); this.log(this.t('event.carpenterRoundWar', { name: sp.name })); this.story(6, [sp.id], [[sp.id, 'chat.carpenterRoundWar']]); }
    }
    return x;
  }

  randomLook(muted = false): Look {
    const P = this.c.palette;
    const styles = Object.keys(this.c.parts.hair ?? { bowl: 0 });
    return {
      skin: this.pick(P.skins),
      hair: muted ? this.pick(['#6b5a4e', '#8a7f78', '#4b4452', '#9c8466']) : this.pick(P.hairs),
      hairStyle: this.pick(styles),
      outfit: muted ? this.pick(['#8b8fa3', '#9a8f86', '#7d8f88']) : this.pick(P.outfits),
    };
  }

  private pickStranger(type: WantId): Stranger | null {
    const live = this.liveStrangers();
    let pool: Stranger[];
    if (type === 'backup') { const hard = live.filter(x => x.kind === 'hooligan' || x.kind === 'gang' || x.kind === 'racists'); const soft = live.filter(x => !x.kind); pool = hard.length && (this.chance(0.6) || !soft.length) ? hard : soft; }
    else if (type === 'dare') { const g = live.filter(x => x.kind === 'gang'); const soft = live.filter(x => !x.kind); pool = g.length && (this.chance(0.6) || !soft.length) ? g : soft; }
    else pool = live.filter(x => !x.kind || x.kind === 'carpenter');
    if (pool.length) return this.pick(pool);
    const n = this.addStranger();
    if (!n) return null;
    if (type === 'wingman' && n.kind && n.kind !== 'carpenter') return null;
    if (type === 'dare' && n.kind && n.kind !== 'gang') return null;
    return n;
  }

  private strangerLeaves(x: Stranger | undefined | null, logKey?: string, vars?: Vars) {
    if (!x || x.left) return;
    x.left = true;
    this.s.friends.forEach(f => { if (f.want && f.want.stranger === x.id) f.want = null; });
    if (logKey) this.log(this.t(logKey, vars));
  }

  // ---------- drink, leave, go out ----------
  addDrunk(f: Friend, v: number) {
    const before = this.active(f);
    f.drunk = clamp(f.drunk + v, 0, 10);
    const after = this.active(f);
    if (before !== after && !f.flipped) {
      f.flipped = true;
      this.log(this.t('event.flip', { name: f.name, from: this.traitName(before), to: this.traitName(after) }));
      this.fx(f.id, this.traitName(after), 'flip');
    }
    if (f.drunk >= 10 && !f.gone && !f.ko) {
      f.ko = true; f.drunk = 9.3;
      if (this.isHere(f)) { f.want = null; const sick = this.chance(0.5); this.spawnWant(f, sick ? 'sick' : 'lost', sick ? 'want.forced.koSick' : 'want.forced.koLost'); }
      return;
    }
    if (f.drunk >= 10 && !f.gone) this.goHome(f, 'reason.blackout', 7, [[f.id, 'chat.blackout']]);
  }

  private goHome(f: Friend, reasonKey: string, weight: number, lines: [string, string, Vars?][] = [], photo?: [string, Vars]) {
    if (f.gone) return;
    const reason = this.t(reasonKey);
    f.gone = reason; f.goneKey = reasonKey; f.want = null; f.zone = 'gone';
    this.log(this.t('event.gone', { name: f.name, reason }));
    this.fx(f.id, this.t('float.gone'), 'chaos');
    this.story(weight, [f.id], lines, photo);
    if (this.active(f) === 'lightweight') {
      this.withActive('lightweight', [f.id]).forEach(o => {
        if (this.bond(o.id, f.id) >= 0) { o.gone = this.t('reason.leftWith', { name: f.name }); o.goneKey = 'reason.leftWith'; o.want = null; o.zone = 'gone'; this.log(this.t('event.lightweightsLeave', { name: o.name, other: f.name })); }
      });
    }
  }

  private outGone(list: Friend[], reasonKey: string, vars?: Vars) { const reason = this.t(reasonKey, vars); list.forEach(o => { o.gone = reason; o.goneKey = reasonKey; o.zone = 'gone'; o.want = null; this.fx(o.id, this.t('float.gone'), 'chaos'); }); }

  private goOut(f: Friend, secs: number, logKey?: string, vars?: Vars) {
    f.returnZone = f.zone === 'door' ? 'table' : f.zone;
    f.zone = 'out'; f.outUntil = this.s.t + secs; f.want = null;
    if (logKey) this.log(this.t(logKey, vars));
  }

  // ---------- wants ----------
  private wantKey(f: Friend, type: WantId, x: Stranger | null): string {
    const a = this.active(f);
    switch (type) {
      case 'beer': return a === 'spender' ? 'want.beer.spender' : 'want.beer.default';
      case 'wingman': return x?.kind === 'carpenter' ? 'want.wingman.carpenter' : 'want.wingman.default';
      case 'backup': return x?.kind ? `want.backup.${x.kind}` : 'want.backup.default';
      case 'dance': return a === 'wallflower' ? 'want.dance.wallflower' : 'want.dance.default';
      case 'dare': return x?.kind === 'gang' ? 'want.dare.gang' : this.chance(0.25) ? 'want.dare.pill' : 'want.dare.default';
      case 'stand': return this.chance(0.5) ? 'want.stand.victim' : 'want.stand.bystander';
      default: return `want.${type}`;
    }
  }

  private spawnWant(f: Friend, type: WantId, forcedKey?: string, vars?: Vars) {
    let x: Stranger | null = null;
    if (type === 'wingman' || type === 'backup' || type === 'dare') { x = this.pickStranger(type); if (!x) type = 'beer'; }
    if (type === 'creep') x = this.kindHere('creep') ?? null;
    if (type === 'stand') x = this.kindHere('racists') ?? null;
    if (type === 'afterparty') x = this.kindHere('carpenter') ?? null;
    const key = forcedKey ?? this.wantKey(f, type, x);
    const w: Want = { type, level: 0, born: this.s.t, text: this.t(key, { s: x?.name, ...vars }), stranger: x?.id, heavy: key === 'want.dare.pill' || key === 'want.dare.gang' };
    f.want = w;
    if (type === 'lost') f.zone = 'door';
    this.log(this.t('event.want', { name: f.name, text: w.text }));
  }

  private chooseWantType(f: Friend): WantId {
    const tr = this.c.traits[this.active(f)];
    const ph = this.phase();
    const phaseMod: Partial<Record<WantId, number>> = ({
      warm: { beer: 1.5, dare: 0.3, lost: 0.2, bush: 1.2, sick: 0 }, peak: { dance: 1.5, dare: 1.3, bush: 1.2 }, comedown: { lost: 2, hug: 1.5, beer: 0.5, dance: 0.8, sick: 1.5 },
    } as const)[ph];
    const w: Partial<Record<WantId, number>> = {};
    (['beer', 'wingman', 'hug', 'backup', 'dance', 'dare', 'lost', 'bush'] as WantId[]).forEach(k => { w[k] = (tr.bias[k] ?? 0.25) * (phaseMod[k] ?? 1); });
    const st = this.stage(f);
    w.sick = st === 'wasted' ? 2.5 : 0;
    if (st === 'wasted') { w.lost! *= 2; w.hug! *= 1.5; w.dance! *= 0.6; }
    if (this.s.bushEmpty) w.bush = 0;
    if (this.withActive('knows').length >= 2 && this.active(f) === 'knows') w.lost! *= 2;
    w.dare! *= 1 + this.withActive('party').length * 0.5;
    if (this.active(f) === 'wallflower' && f.zone === 'table' && this.withActive('wallflower', [f.id]).some(o => o.zone === 'table')) w.dance! *= 0.4;
    const busyWith = (kind: EncounterKind) => this.s.friends.some(o => o.want?.stranger && (this.person(o.want.stranger) as Stranger | undefined)?.kind === kind);
    if (this.kindHere('creep') && !busyWith('creep')) w.creep = 1.6 * (st !== 'sober' ? 1.5 : 1);
    if (this.kindHere('racists') && !busyWith('racists')) w.stand = 1.3;
    if (this.kindHere('carpenter') && ph !== 'warm' && !busyWith('carpenter')) w.afterparty = 1.2 * (ph === 'comedown' ? 1.8 : 1);
    if (this.kindHere('hooligan')) w.backup! += 1.2;
    if (this.kindHere('gang')) w.dare! += 0.8;
    const entries = Object.entries(w) as [WantId, number][];
    let r = this.rng() * entries.reduce((a, [, v]) => a + v, 0);
    for (const [k, v] of entries) { r -= v; if (r <= 0) return k; }
    return 'beer';
  }

  // ---------- rolls ----------
  skill(f: Friend, key: Skill, vsNPC = false) {
    const tr = this.c.traits[this.active(f)];
    let v = vsNPC && key === 'charm' && tr.npcCharm !== undefined ? tr.npcCharm : tr.skills[key];
    const st = this.stage(f);
    if (st === 'tipsy' && key === 'wild') v += 1;
    if (st === 'wasted') v -= 1;
    return v;
  }

  private linked(a: string, b: string, list: [string, string][]) { return list.some(([x, y]) => (x === a && y === b) || (x === b && y === a)); }

  private roll(h: Friend, target: Friend | null, key: Skill, diff: number, extras: [string, number][] = [], vsNPC = false) {
    const parts: [string, number][] = [[key, this.skill(h, key, vsNPC)]];
    if (target && target.id !== h.id) {
      const b = clamp(Math.round(this.bond(h.id, target.id)), -2, 2); if (b) parts.push(['bond', b]);
      const A = this.active(h), B = this.active(target);
      if (this.linked(A, B, this.c.links.clicks)) parts.push(['click', 1]);
      if (this.linked(A, B, this.c.links.clashes)) parts.push(['clash', -1]);
    }
    parts.push(...extras);
    parts.push(['d6', 1 + Math.floor(this.rng() * 6)]);
    const total = parts.reduce((a, [, v]) => a + v, 0);
    const margin = total - diff;
    const tier: Tier = margin >= 2 ? 'nailed' : margin >= 0 ? 'fine' : margin >= -2 ? 'backfire' : 'chaos';
    return { tier, math: parts.map(([l, v]) => `${l} ${v >= 0 ? '+' : ''}${v}`).join(', ') + ` = ${total} vs ${diff}` };
  }

  // ---------- player actions ----------
  sendTo(hid: string, tid: string) {
    const h = this.friend(hid), t = this.person(tid);
    if (!h || !t || !this.avail(h)) return;
    if (t.stranger) { this.log(this.t(t.kind ? `stranger.greet.${t.kind}` : 'stranger.greet.default', { h: h.name, s: t.name })); return; }
    if (!this.isHere(t)) return;
    if (!t.want) {
      if (t.zone !== 'door') h.zone = t.zone;
      this.addBond(h.id, t.id, 0.3); h.busy = this.s.t + 2;
      this.fx(t.id, this.t('float.hangout'), 'fine');
      this.log(this.t('event.hangout', { h: h.name, t: t.name }));
      return;
    }
    if (this.s.t < t.busy) return;
    this.resolve(h, t);
  }

  sendPlace(hid: string, place: Place) {
    const h = this.friend(hid); if (!h || !this.avail(h)) return;
    const s = this.s, B = this.T.busySeconds;
    if (place === 'floor' || place === 'table') {
      if (place === 'floor' && h.want?.type === 'dance') { this.resolve(h, h); return; }
      h.zone = place; h.busy = s.t + 1; this.log(this.t(`place.go.${place}`, { h: h.name })); return;
    }
    if (place === 'simon') {
      if (h.want?.type === 'beer') { this.resolve(h, h); return; }
      h.zone = 'bar'; h.busy = s.t + B;
      const r = this.roll(h, null, 'charm', 5, [], true);
      this.addDrunk(h, 1);
      if (r.tier === 'nailed' || r.tier === 'fine') { this.addJoy(h, 0.5); this.log(this.t('place.simon.free', { h: h.name }), r.math); this.fx(h.id, this.t('float.freeBeer'), 'fine'); }
      else { this.log(this.t('place.simon.paid', { h: h.name }), r.math); this.fx(h.id, this.t('float.fullPrice'), 'backfire'); }
      return;
    }
    if (place === 'anders') {
      h.busy = s.t + B;
      const trouble = (['creep', 'racists', 'hooligan', 'gang'] as EncounterKind[]).map(k => this.kindHere(k)).find(Boolean);
      if (trouble) {
        const r = this.roll(h, null, 'charm', trouble.kind === 'gang' ? 8 : 4, [], true);
        if (r.tier === 'nailed' || r.tier === 'fine') {
          this.strangerLeaves(trouble, 'place.anders.report', { h: h.name, s: trouble.name });
          this.fx(h.id, this.t('float.andersFixes'), 'nailed');
          this.story(5, [h.id], [[h.id, 'chat.andersFixes', { s: trouble.name.toLowerCase() }]]);
        } else {
          this.log(this.t(trouble.kind === 'gang' ? 'place.anders.scared' : 'place.anders.watching', { h: h.name }), r.math);
          this.fx(h.id, this.t('float.watching'), 'backfire');
        }
        return;
      }
      const r = this.roll(h, null, 'charm', 4, [], true);
      if (r.tier === 'nailed' || r.tier === 'fine') { s.anders = Math.max(0, s.anders - 1); this.log(this.t('place.anders.chat', { h: h.name }), r.math); this.fx(h.id, this.t('float.andersLikes'), 'nailed'); }
      else { s.anders += 0.5; this.log(this.t('place.anders.ignored', { h: h.name }), r.math); this.fx(h.id, this.t('float.ignored'), 'backfire'); }
      return;
    }
    if (place === 'bush') {
      if (s.bushEmpty) { this.log(this.t('place.bush.empty')); return; }
      if (h.want?.type === 'bush') { this.resolve(h, h); return; }
      h.busy = s.t + B; s.anders += 0.5; this.addDrunk(h, 2); this.addJoy(h, 0.5);
      this.log(this.t('place.bush.alone', { h: h.name }));
      if (this.andersCheck(h, this.active(h) === 'knows')) this.fx(h.id, this.t('float.bushRun'), 'fine');
    }
  }

  // ---------- resolving a want ----------
  private resolve(h: Friend, t: Friend, volunteer = false) {
    const w = t.want; if (!w) return;
    const type = w.type, def = this.c.wants[type];
    const x = w.stranger ? (this.person(w.stranger) as Stranger | undefined) ?? null : null;
    const self = h.id === t.id;
    let key: Skill = def.key ?? 'charm';
    let path: 'push' | 'calm' | null = null;
    if (def.duo) { const [a, b] = def.duo; key = this.skill(h, a) >= this.skill(h, b) ? a : b; path = key === a ? 'push' : 'calm'; }
    let diff = 4 + (w.level >= 2 ? 1 : 0);
    const extras: [string, number][] = [];
    if (type === 'dance' && this.active(t) === 'wallflower') diff += 2;
    if ((type === 'lost' || type === 'sick') && this.stage(t) === 'wasted') diff += 1;
    if (type === 'dance') { const pa = this.s.friends.filter(f => this.isHere(f) && f.zone === 'floor' && this.active(f) === 'party' && f.id !== h.id).length; if (pa) extras.push(['party animal on floor', Math.min(pa, 2)]); }
    if (type === 'dance' && this.s.remix.state === 'playing') extras.push(['remix', 3]);
    if (type === 'backup' && x) { if (x.kind === 'gang') diff += 2; else if (x.kind || x.trait === 'hothead') diff += 1; }
    if (type === 'stand' && path === 'calm') extras.push(['Anders helps', 1]);
    if ((type === 'lost' || type === 'sick') && this.active(h) === 'mum') extras.push(['mum', 3]);
    if (type === 'lost' && this.active(h) === 'wallflower') extras.push(['wallflower notices', 2]);
    let buddy: Friend | undefined;
    if (this.active(h) === 'loyal') { buddy = this.withActive('loyal', [h.id, t.id]).find(f => this.avail(f)); if (buddy) extras.push([`${buddy.name} tags along`, 1]); }
    const vsNPC = type === 'beer' || type === 'wingman' || (type === 'stand' && path === 'calm');
    let r = this.roll(h, t, key, diff, extras, vsNPC);
    const who = self ? h.name : `${h.name} → ${t.name}`;
    const sig = this.signature(h, t, type, path, r.tier, x);
    if (sig?.tier) r = { ...r, tier: sig.tier };
    h.busy = this.s.t + this.T.busySeconds; t.busy = this.s.t + this.T.busySeconds;
    if (t.want === w) t.want = null;
    if (buddy) { buddy.busy = this.s.t + this.T.busySeconds; buddy.zone = h.zone; }
    if (volunteer) this.log(this.t('event.volunteer', { h: h.name }));
    this.fx(t.id, sig?.float ?? this.t(`float.${r.tier}`), r.tier);
    if (!self) this.addBond(h.id, t.id, { nailed: 1, fine: 0.3, backfire: -0.5, chaos: -1 }[r.tier]);
    if (sig?.handled) { this.log(`${who}: ${sig.text}`, r.math + ' (combo)'); return; }
    const text = this.outcome(type, h, t, x, r.tier, path, self, w);
    this.log(`${who}: ${text}`, r.math);
  }

  private later(f: Friend, type: WantId, key: string, vars: Vars) { this.s.pending.push({ at: this.s.t + 5, id: f.id, type, key, vars }); }

  /** Hand-written moments for specific pairs. Text lives in content/text/<lang>/combos.yaml. */
  private signature(h: Friend, t: Friend, type: WantId, _path: 'push' | 'calm' | null, tier: Tier, x: Stranger | null): { tier?: Tier; handled?: boolean; text: string; float?: string } | null {
    const A = this.active(h), B = this.active(t);
    const v = { h: h.name, t: t.name, s: x?.name, T: t.name.toUpperCase() };
    const done = (name: string, newTier?: Tier) => ({ tier: newTier, handled: true, text: this.t(`combo.${name}.text`, v), float: this.t(`combo.${name}.float`, v) });

    if (x?.kind === 'gang' && A === 'knows' && (type === 'backup' || type === 'dare')) {
      this.strangerLeaves(x);
      this.story(6, [h.id, t.id], [[t.id, 'combo.knowsGang.chat', v]]);
      return done('knowsGang', 'nailed');
    }
    if (type === 'backup' && x?.kind === 'hooligan' && A === 'party' && tier !== 'chaos') {
      this.addJoy(h, 2); this.addJoy(t, 2);
      this.story(7, [h.id, t.id], [[h.id, 'combo.chants.chat1', v], [t.id, 'combo.chants.chat2', v]], ['combo.chants.photo', v]);
      return done('chants', 'nailed');
    }
    if (type === 'creep' && A === 'mum') {
      this.strangerLeaves(x, 'event.creepLeaves'); this.addJoy(t, 2);
      this.story(7, [h.id, t.id], [[t.id, 'combo.mumCreep.chat1', v], [h.id, 'combo.mumCreep.chat2', v]]);
      return done('mumCreep', 'nailed');
    }
    if (type === 'creep' && A === 'hothead' && tier !== 'backfire') {
      if (this.chance(0.5)) {
        this.strangerLeaves(x, 'event.creepThrownOut'); this.addJoy(t, 1); this.addJoy(h, 2);
        this.story(8, [h.id, t.id], [[h.id, 'combo.beerOnKaj.chat', v]]);
        return done('beerOnKaj', 'nailed');
      }
      this.outGone([h], 'reason.beerOnOldMan');
      this.story(7, [h.id], [[h.id, 'combo.beerOnKajOut.chat', v]]);
      return done('beerOnKajOut', 'chaos');
    }
    if (type === 'wingman' && A === 'charmer' && B === 'wallflower' && (tier === 'nailed' || tier === 'fine')) {
      this.addJoy(t, 3); t.danced = true;
      this.story(9, [t.id, h.id], [[h.id, 'combo.picked.chat', v]], ['combo.picked.photo', v]);
      return done('picked');
    }
    if (type === 'backup' && A === 'mum' && B === 'hothead') {
      this.addJoy(t, -0.5); this.later(t, 'hug', 'want.forced.sulking', {});
      this.story(5, [h.id, t.id], [[t.id, 'combo.byTheEar.chat', v]]);
      return done('byTheEar', 'nailed');
    }
    if (type === 'backup' && A === 'hothead' && B === 'softie' && tier !== 'chaos') {
      this.addJoy(t, -1); this.addJoy(h, 1);
      this.story(5, [h.id, t.id], [[t.id, 'combo.tooMuch.chat', v]]);
      return done('tooMuch');
    }
    if (type === 'backup' && A === 'loyal' && B === 'hothead') {
      this.addBond(h.id, t.id, 2); this.s.anders += 1;
      this.outGone([h, t], 'reason.thrownOut');
      this.story(8, [h.id, t.id], [[h.id, 'combo.downTogether.chat1', v], [t.id, 'combo.downTogether.chat2', v]], ['combo.downTogether.photo', v]);
      return done('downTogether', 'chaos');
    }
    if (type === 'dance' && A === 'party' && B === 'wallflower') {
      if (this.chance(0.5)) {
        h.zone = 'floor'; t.zone = 'floor'; this.addJoy(t, 3); this.addJoy(h, 2); t.danced = true;
        this.story(9, [t.id, h.id], [[h.id, 'combo.magic.chat', v]], ['combo.magic.photo', v]);
        return done('magic', 'nailed');
      }
      this.addJoy(t, -1); this.goOut(t, 25);
      this.story(5, [t.id], [[t.id, 'combo.fled.chat', v]]);
      return done('fled', 'backfire');
    }
    if (type === 'beer' && A === 'spender' && h.id !== t.id) {
      this.s.friends.filter(f => this.isHere(f)).forEach(f => { this.addDrunk(f, 0.8); this.addJoy(f, 1); });
      if (this.s.remix.state === 'waiting' && this.phase() !== 'comedown') { this.s.remix.at = this.s.t + 16; this.log(this.t('event.remixEarly')); }
      this.story(6, [h.id], [[t.id, 'combo.wholeBar.chat1', v], [h.id, 'combo.wholeBar.chat2', v]]);
      return done('wholeBar', 'nailed');
    }
    if (type === 'hug' && A === 'drama' && (B === 'softie' || this.chance(0.3)) && tier !== 'chaos') {
      this.addJoy(t, 2);
      this.story(5, [h.id, t.id], [[h.id, 'combo.dramaHug.chat1', v], [t.id, 'combo.dramaHug.chat2', v]]);
      return done('dramaHug');
    }
    if (type === 'wingman' && A === 'jealous' && h.crush === t.id) {
      this.addJoy(t, -1); this.addJoy(h, 1);
      this.story(6, [h.id, t.id], [[t.id, 'combo.sabotage.chat', v]]);
      return done('sabotage', 'backfire');
    }
    if (type === 'wingman' && A === 'lightweight') {
      this.addJoy(t, 2); this.addDrunk(h, 2);
      this.story(5, [h.id, t.id], [[t.id, 'combo.talker.chat', v]]);
      return done('talker', 'nailed');
    }
    if ((type === 'lost' || type === 'sick') && A === 'mum') {
      if (this.stage(t) === 'wasted') {
        this.outGone([h], 'reason.tookHome', { name: t.name }); this.outGone([t], 'reason.takenHome', { name: h.name });
        this.story(7, [h.id, t.id], [[t.id, 'combo.carried.chat', v]]);
        return done('carried', 'nailed');
      }
      t.zone = 'table'; this.addDrunk(t, -1); this.addJoy(t, 1);
      return done('found', 'nailed');
    }
    return null;
  }

  private fight(h: Friend, t: Friend, x: Stranger | null): string {
    const sname = x?.name ?? this.t('word.aStranger');
    if (this.chance(this.T.fightUnseenChance)) {
      [h, t].forEach(p => this.addJoy(p, -1));
      this.story(4, [t.id], [[t.id, 'chat.almostOut']]);
      return this.t('fight.unseen', { s: sname });
    }
    const cands = [t, h].filter(p => !p.gone);
    const first = [...cands].sort((a, b) => this.skill(b, 'heat') - this.skill(a, 'heat'))[0];
    const out = [first];
    this.withActive('hothead', out.map(o => o.id)).forEach(o => { if (this.chance(0.5)) out.push(o); });
    const names = out.map(o => o.name).join(` ${this.t('word.and')} `);
    const ids = out.map(o => o.id);
    const other = this.pick(this.s.friends).id;
    if (x?.kind === 'gang') {
      this.outGone(out, 'reason.hospital');
      this.strangerLeaves(x, 'event.gangVanishes');
      this.story(9, ids, [[out[0].id, 'chat.hospital'], [other, 'chat.areYouOk']]);
      return this.t('fight.gang', { names });
    }
    if (x?.kind === 'hooligan' && this.chance(0.45)) {
      this.outGone(out, 'reason.arrested');
      this.strangerLeaves(x, 'event.policeTakeHooligan');
      this.story(9, ids, [[out[0].id, 'chat.arrested']], ['photo.arrested', { names }]);
      return this.t('fight.police', { names });
    }
    this.s.anders += 1;
    this.outGone(out, x?.kind === 'racists' ? 'reason.thrownOutRacists' : 'reason.thrownOut');
    out.forEach(o => this.fx(o.id, this.t('float.thrownOut'), 'chaos'));
    if (x?.kind === 'racists') {
      if (this.chance(0.5)) this.strangerLeaves(x, 'event.racistsThrownOutToo');
      this.story(8, ids, [[out[0].id, 'chat.thrownOutRacists']]);
    } else {
      const lines: [string, string, Vars?][] = [[out[0].id, 'chat.thrownOut']];
      if (out.length > 1) lines.push([out[1].id, 'chat.hadTo']);
      this.story(8, ids, lines, ['photo.curb', { names }]);
    }
    if (out.length > 1) this.log(this.t('event.hotheadJoins', { names }));
    return this.t('fight.thrownOut', { s: sname, names });
  }

  private andersCheck(f: Friend, pass: boolean) {
    if (pass) return true;
    const A = this.T.anders;
    const limit = Math.max(A.minLimit, A.limit - Math.min(this.s.anders, 4) * 0.5);
    if (f.drunk >= limit && this.chance(A.turnAwayChance)) {
      this.goHome(f, 'reason.turnedAway', 7, [[f.id, 'chat.inTheBush']]);
      return false;
    }
    return true;
  }

  private joinDare(t: Friend, tier: Tier, heavy: boolean): string {
    if (tier === 'nailed' || tier === 'fine') { this.addJoy(t, tier === 'nailed' ? 2 : 1); this.addDrunk(t, heavy ? 2 : 1); return this.t(heavy ? 'out.dare.didHeavy' : 'out.dare.did'); }
    if (tier === 'backfire') { this.addDrunk(t, 3); this.addJoy(t, -1); return this.t('out.dare.regret'); }
    this.goHome(t, 'reason.unwell', 9, [[t.id, heavy ? 'chat.unwellHeavy' : 'chat.unwell']]);
    return this.t('out.dare.badly');
  }

  private outcome(type: WantId, h: Friend, t: Friend, x: Stranger | null, tier: Tier, path: 'push' | 'calm' | null, self: boolean, w: Want): string {
    const v = { h: h.name, t: t.name, s: x?.name };
    const o = (k: string, extra?: Vars) => this.t(`out.${type}.${k}`, { ...v, ...extra });
    const s = this.s;
    switch (type) {
      case 'beer': {
        h.zone = 'bar';
        if (this.active(t) === 'spender') {
          const table = s.friends.filter(f => this.isHere(f) && f.zone === 'table');
          if (tier === 'nailed' || tier === 'fine') { table.forEach(f => { this.addDrunk(f, 0.8); this.addJoy(f, 1); }); t.zone = 'table'; this.story(4, [t.id], [[t.id, 'chat.round']]); return o('round'); }
          if (tier === 'backfire') { this.addJoy(t, -1); this.story(3, [t.id], [[t.id, 'chat.cardDeclined']]); return o('declined'); }
          table.forEach(f => this.addJoy(f, -0.5)); return o('spilled');
        }
        if (tier === 'nailed') { this.addDrunk(t, 1); this.addJoy(t, 1); this.addJoy(h, 0.5); return o('nailed'); }
        if (tier === 'fine') { this.addDrunk(t, 1); return o('fine'); }
        if (tier === 'backfire') { this.addJoy(t, -1); return o('backfire'); }
        this.addJoy(h, -1); this.addJoy(t, -1); this.story(3, [h.id], [[h.id, 'chat.tray']]); return o('chaos');
      }
      case 'wingman': {
        if (tier === 'nailed' || tier === 'chaos') {
          const steal = tier === 'chaos' || (this.active(h) === 'charmer' && this.chance(0.3));
          if (steal) {
            this.addJoy(h, 2); this.addJoy(t, -2); this.addBond(h.id, t.id, -2);
            this.later(t, 'hug', 'want.forced.watchedLeave', v);
            this.story(8, [h.id, t.id], [[t.id, 'chat.stolen1', v], [h.id, 'chat.stolen2', v]], ['photo.smokingArea', { a: h.name, b: x!.name }]);
            return o('steal');
          }
          this.addJoy(t, 2);
          s.friends.filter(f => this.isHere(f) && this.active(f) === 'jealous' && f.crush === t.id && f.id !== h.id).forEach(j => { this.addJoy(j, -1); if (!j.want) this.later(j, 'hug', 'want.forced.watchingFlirt', v); });
          const rival = this.withActive('charmer', [h.id, t.id])[0];
          if (rival && this.chance(0.3)) { this.addBond(rival.id, t.id, -1); this.story(5, [rival.id, t.id], [[t.id, 'chat.rival', { r: rival.name }]]); return o('rival', { r: rival.name }); }
          if (x?.kind === 'carpenter') { this.addDrunk(t, 1.5); this.story(6, [t.id], [[t.id, 'chat.terrace']]); return o('carpenter'); }
          if (this.chance(0.4)) { this.goOut(t, 20); this.story(6, [t.id], [[h.id, 'chat.smokingArea', v]], ['photo.smokingArea', { a: t.name, b: x!.name }]); return o('smokingArea'); }
          this.story(4, [t.id, h.id], [[t.id, 'chat.bestWingman', v]]);
          return o('nailed');
        }
        if (tier === 'fine') { this.addJoy(t, 1); return o('fine'); }
        this.addJoy(t, -1); this.addBond(h.id, t.id, -0.5); return o('backfire');
      }
      case 'hug': {
        if (tier === 'nailed') { this.addJoy(t, 2); if (this.active(t) === 'softie') this.story(3, [t.id, h.id], [[t.id, 'chat.thanksHug', v]]); return o('nailed'); }
        if (tier === 'fine') { this.addJoy(t, 1); return o('fine'); }
        if (tier === 'backfire') return o('backfire');
        this.addJoy(t, -1); return o('chaos');
      }
      case 'backup': {
        if (path === 'push') {
          const fc = 0.12 + (this.active(h) === 'hothead' ? 0.15 : 0) + (x?.kind ? 0.15 : 0);
          if (tier === 'nailed') { this.addJoy(t, 1); this.addJoy(h, 1); if (this.chance(fc)) return o('push.nailedFight', { rest: this.fight(h, t, x) }); return o('push.nailed'); }
          if (tier === 'fine') return o('push.fine');
          if (tier === 'backfire') { if (this.chance(0.4)) return o('push.backfireFight', { rest: this.fight(h, t, x) }); this.addJoy(t, -1); return o('push.backfire'); }
          return this.fight(h, t, x);
        }
        if (tier === 'nailed') { this.addJoy(t, 1); return o('calm.nailed'); }
        if (tier === 'fine') return o('calm.fine');
        if (tier === 'backfire') { this.addJoy(h, -1); return o('calm.backfire'); }
        return o('calm.chaos', { rest: this.fight(h, t, x) });
      }
      case 'dance': {
        const firstWall = this.active(t) === 'wallflower' && !t.danced;
        if (tier === 'nailed' || tier === 'fine') {
          h.zone = 'floor'; t.zone = 'floor'; this.addJoy(t, tier === 'nailed' ? 2 : 1); this.addJoy(h, tier === 'nailed' ? 2 : 1);
          if (firstWall) { t.danced = true; this.story(8, [t.id, h.id], [[h.id, 'chat.firstDance', v]], ['photo.firstDance', v]); }
          return self ? o('alone') : o(tier);
        }
        if (tier === 'backfire') { this.addJoy(t, -1); return o('backfire'); }
        this.addJoy(t, -1); h.zone = 'floor'; this.story(4, [t.id], [[h.id, 'chat.fell', v]]); return o('chaos');
      }
      case 'dare': {
        const heavy = !!w.heavy;
        if (path === 'calm') {
          if (tier === 'nailed') { this.addBond(h.id, t.id, 1); return o('calm.nailed'); }
          if (tier === 'fine') { this.addJoy(t, -0.5); return o('calm.fine'); }
          if (tier === 'backfire') return o('calm.backfire', { rest: this.joinDare(t, this.chance(0.5) ? 'fine' : 'backfire', heavy) });
          this.joinDare(h, 'backfire', heavy); return o('calm.chaos', { rest: this.joinDare(t, 'chaos', heavy) });
        }
        if (tier === 'nailed') { this.addJoy(h, 2); this.addDrunk(h, 1); this.story(6, [t.id, h.id], [[h.id, heavy ? 'chat.lamppost' : 'chat.bestDare']]); return o('push.together', { rest: this.joinDare(t, 'nailed', heavy) }); }
        return this.joinDare(t, tier, heavy);
      }
      case 'lost': {
        if (tier === 'nailed') { t.zone = 'table'; h.zone = 'table'; this.addJoy(t, 1); this.addBond(h.id, t.id, 1); this.addDrunk(t, -1); this.story(3, [t.id, h.id], [[t.id, 'chat.foundKebab', v]]); return o('nailed'); }
        if (tier === 'fine') { t.zone = 'table'; return o('fine'); }
        if (tier === 'backfire') { t.want = { type: 'lost', level: 1, born: s.t - this.T.escalateEvery, text: this.t('want.forced.lostAgain') }; t.zone = 'door'; return o('backfire'); }
        if (this.chance(0.5)) { this.goHome(t, 'reason.afterpartyStrangers', 7, [[t.id, 'chat.garage']]); this.addJoy(h, -1); return o('chaosOne'); }
        this.outGone([h, t], 'reason.afterpartyGarage');
        this.story(8, [h.id, t.id], [[t.id, 'chat.garage1'], [h.id, 'chat.garage2']]);
        return o('chaosBoth');
      }
      case 'bush': {
        s.anders += 0.5;
        const pass = this.active(h) === 'knows' || this.active(t) === 'knows';
        if (tier === 'nailed' || tier === 'fine') {
          this.addDrunk(t, 2); if (!self) this.addDrunk(h, tier === 'nailed' ? 2 : 1); this.addJoy(t, 1);
          const okT = this.andersCheck(t, pass); const okH = self ? okT : this.andersCheck(h, pass);
          if (pass) return o('knowsDad');
          return okT && okH ? o('ok') : o('turnedAway');
        }
        if (tier === 'backfire') { s.bushEmpty = true; this.addJoy(t, -1); if (!self) this.addJoy(h, -1); this.story(4, [t.id], [[t.id, 'chat.bushStolen']]); return o('stolen'); }
        s.anders += 1;
        this.goHome(t, 'reason.caughtWithBottle', 7, [[t.id, 'chat.banned']]);
        return o('caught');
      }
      case 'sick': {
        if (tier === 'nailed') { this.addDrunk(t, -1.5); this.addJoy(t, 1); this.addBond(h.id, t.id, 1.5); this.story(5, [t.id, h.id], [[t.id, 'chat.hair', v]]); return o('nailed'); }
        if (tier === 'fine') { this.addDrunk(t, -1); return o('fine'); }
        if (tier === 'backfire') { this.addJoy(h, -2); this.story(5, [h.id], [[h.id, 'chat.shoes', v]]); return o('backfire'); }
        this.goHome(t, 'reason.sickAtBar', 7, [[t.id, 'chat.sorrySimon']]);
        return o('chaos');
      }
      case 'creep': {
        if (path === 'push') {
          if (tier === 'nailed') { this.strangerLeaves(x, 'event.creepThrownOut'); this.addJoy(t, 2); this.addJoy(h, 1); this.story(7, [h.id, t.id], [[t.id, 'chat.kajOut', v]]); return o('push.nailed'); }
          if (tier === 'fine') { this.addJoy(t, 1); return o('push.fine'); }
          if (tier === 'backfire') { this.addJoy(t, -1); return o('push.backfire'); }
          this.outGone([h], 'reason.pushedOldMan');
          this.story(7, [h.id], [[h.id, 'chat.systemBroken']]);
          return o('push.chaos');
        }
        if (tier === 'nailed') { h.zone = 'floor'; t.zone = 'floor'; this.addJoy(t, 2); this.addBond(h.id, t.id, 1); this.story(5, [t.id, h.id], [[t.id, 'chat.fakeCouple', v]]); return o('calm.nailed'); }
        if (tier === 'fine') { t.zone = 'table'; return o('calm.fine'); }
        if (tier === 'backfire') { t.want = { type: 'creep', level: 1, born: s.t - this.T.escalateEvery, stranger: x?.id, text: this.t('want.forced.followed') }; return o('calm.backfire'); }
        this.addJoy(t, -3);
        this.goHome(t, 'reason.creepedOut', 7, [[t.id, 'chat.tellOwner']]);
        return o('calm.chaos');
      }
      case 'stand': {
        if (path === 'push') {
          if (tier === 'nailed') { this.addJoy(t, 2); this.addJoy(h, 2); this.addBond(h.id, t.id, 1); this.strangerLeaves(x, 'event.racistsLeave'); this.story(8, [h.id, t.id], [[t.id, 'chat.stoodUp', v]], ['photo.stoodUp', v]); return o('push.nailed'); }
          if (tier === 'fine') { this.addJoy(t, 1); return o('push.fine'); }
          if (tier === 'backfire') { if (this.chance(0.5)) return o('push.backfireFight', { rest: this.fight(h, t, x) }); this.addJoy(h, -1); this.addJoy(t, -1); return o('push.backfire'); }
          return this.fight(h, t, x);
        }
        if (tier === 'nailed' || tier === 'fine') { this.strangerLeaves(x, 'event.racistsThrownOut'); this.addJoy(t, 1); this.story(6, [h.id], [[t.id, 'chat.andersGoat']]); return o('calm.nailed'); }
        if (tier === 'backfire') { this.addJoy(t, -1); return o('calm.backfire'); }
        s.anders += 1; this.outGone([h], 'reason.wrongOneOut');
        this.story(7, [h.id], [[h.id, 'chat.doneWithZwei']]);
        return o('calm.chaos');
      }
      case 'afterparty': {
        if (path === 'push') {
          if (tier === 'nailed' || tier === 'fine') {
            const who = self ? [t] : [h, t];
            this.outGone(who, 'reason.afterpartyTommy');
            this.strangerLeaves(x);
            const names = who.map(p => p.name).join(` ${this.t('word.and')} `);
            this.story(tier === 'nailed' ? 8 : 6, who.map(p => p.id), [[t.id, tier === 'nailed' ? 'chat.jacuzzi' : 'chat.footballCarport']], ['photo.jacuzzi', { names }]);
            return o(tier === 'nailed' ? 'push.nailed' : 'push.fine');
          }
          if (tier === 'backfire') { this.addJoy(t, -1); return o('push.backfire'); }
          this.outGone([t], 'reason.stranded');
          this.story(8, [t.id], [[t.id, 'chat.stranded']]);
          return o('push.chaos');
        }
        if (tier === 'nailed' || tier === 'fine') { this.addBond(h.id, t.id, 1); this.strangerLeaves(x, 'event.tommyLeaves'); return o('calm.nailed'); }
        if (tier === 'backfire') { this.outGone([t], 'reason.afterpartyAnyway'); this.story(6, [t.id], [[t.id, 'chat.coldJacuzzi']]); return o('calm.backfire'); }
        this.outGone([h, t], 'reason.afterpartyBoth');
        this.story(7, [h.id, t.id], [[h.id, 'chat.companyVan', v]]);
        return o('calm.chaos');
      }
    }
  }

  // ---------- ignored wants ----------
  private ignored(f: Friend) {
    const w = f.want!; const x = w.stranger ? (this.person(w.stranger) as Stranger | undefined) ?? null : null;
    const v = { name: f.name, s: x?.name ?? this.t('word.theStranger') };
    f.want = null;
    this.fx(f.id, this.t('float.overlooked'), 'backfire');
    const s = this.s;
    switch (w.type) {
      case 'beer': this.addJoy(f, -1); this.addDrunk(f, 1); this.log(this.t('ignored.beer', v)); break;
      case 'wingman':
        if (this.chance(0.5)) { this.addJoy(f, 1); this.log(this.t('ignored.wingman.ok', v)); }
        else { this.addJoy(f, -2); this.log(this.t('ignored.wingman.bad', v)); this.story(4, [f.id], [[f.id, 'chat.noWingman']]); }
        break;
      case 'hug':
        this.addJoy(f, -2); this.log(this.t('ignored.hug', v));
        if (this.active(f) === 'softie') this.here().filter(o => o.id !== f.id && ['softie', 'loyal'].includes(this.active(o))).forEach(o => this.addJoy(o, -1));
        break;
      case 'backup':
        if (this.chance(0.45)) this.log(this.t('ignored.backup.fight', { ...v, rest: this.fight(f, f, x) }));
        else { this.addJoy(f, -1.5); this.log(this.t('ignored.backup.lost', v)); }
        break;
      case 'dance': this.addJoy(f, -1); this.log(this.t('ignored.dance', v)); break;
      case 'dare': { const r = this.roll(f, null, 'wild', 4); this.log(this.t('ignored.dare', { ...v, rest: this.joinDare(f, r.tier, !!w.heavy) }), r.math); break; }
      case 'lost': this.goHome(f, 'reason.vanished', 7, [[f.id, 'chat.vanished']]); break;
      case 'bush': this.addDrunk(f, 2); s.anders += 0.5; this.log(this.t('ignored.bush', v)); this.andersCheck(f, this.active(f) === 'knows'); break;
      case 'sick':
        if (this.chance(0.5)) this.goHome(f, 'reason.sickSentHome', 7, [[f.id, 'chat.dontTalk']]);
        else { this.addJoy(f, -1.5); this.addDrunk(f, -1); this.log(this.t('ignored.sick', v)); }
        break;
      case 'creep':
        this.addJoy(f, -2.5); this.log(this.t('ignored.creep', v));
        this.story(6, [f.id], [[f.id, 'chat.nobodySawKaj']]);
        if (f.joy <= -2) this.goHome(f, 'reason.kajWouldntStop', 7);
        break;
      case 'stand':
        this.addJoy(f, -2); this.log(this.t('ignored.stand', v));
        this.story(6, [f.id], [[f.id, 'chat.shouldHaveSaid']]);
        break;
      case 'afterparty':
        if (this.chance(0.5)) { this.outGone([f], 'reason.afterpartyTommy'); this.story(6, [f.id], [[f.id, 'chat.nobodyStoppedMe']]); this.strangerLeaves(x); this.log(this.t('ignored.afterparty.went', v)); }
        else this.log(this.t('ignored.afterparty.declined', v));
        break;
    }
  }

  // ---------- time ----------
  step(dt: number) {
    const s = this.s;
    if (!s || s.ended) return;
    const prevT = s.t;
    s.t = Math.min(s.len, s.t + dt);
    const crossed = (sec: number) => Math.floor(prevT / sec) !== Math.floor(s.t / sec);
    const T = this.T;

    s.pending = s.pending.filter(p => {
      if (s.t < p.at) return true;
      const f = this.friend(p.id); if (f && this.isHere(f) && !f.want) this.spawnWant(f, p.type, p.key, p.vars);
      return false;
    });
    s.friends.forEach(f => { if (f.zone === 'out' && !f.gone && s.t >= f.outUntil) { f.zone = f.returnZone ?? 'table'; this.log(this.t('event.back', { name: f.name })); } });

    for (const f of s.friends) {
      if (!f.want || f.gone) continue;
      const lvl = Math.floor((s.t - f.want.born) / T.escalateEvery);
      if (lvl === f.want.level) continue;
      f.want.level = lvl;
      if (lvl >= 3) { this.ignored(f); continue; }
      if (lvl === 1 && f.want.type === 'hug' && this.active(f) === 'softie') {
        const o = this.withActive('softie', [f.id]).find(x => this.avail(x) && !x.want);
        if (o) {
          f.want = null; this.addJoy(f, 1.5); this.addJoy(o, 1.5); this.addBond(f.id, o.id, 1);
          this.goOut(f, 15); this.goOut(o, 15, 'event.cryTogether', { a: o.name, b: f.name });
          this.story(5, [f.id, o.id], [[o.id, 'chat.cryClub']]);
          this.fx(f.id, this.t('float.cryTogether'), 'fine');
          continue;
        }
      }
      if (lvl === 2) {
        const loyal = this.here().find(x => x.id !== f.id && this.active(x) === 'loyal' && this.avail(x) && !x.want && this.bond(x.id, f.id) >= 0);
        if (loyal && s.t >= f.busy) this.resolve(loyal, f, true);
      }
    }

    if (crossed(1)) {
      const ph = this.phase(), D = T.director;
      const present = this.here();
      const open = present.filter(f => f.want).length;
      const target = Math.max(1, Math.round(D.targetOpen[ph] * present.length / 5));
      const ch = D.chance[ph] * Math.min(1, present.length / 5);
      const gap = D.gap[ph] * Math.max(1, 5 / Math.max(1, present.length));
      if (open < target && s.t - s.lastSpawn >= gap && this.rng() < ch) {
        const cands = present.filter(f => !f.want && this.avail(f));
        if (cands.length) {
          s.lastSpawn = s.t;
          const rate = (f: Friend) => this.c.traits[this.active(f)].rate;
          let r = this.rng() * cands.reduce((a, f) => a + rate(f), 0), chosen = cands[0];
          for (const f of cands) { r -= rate(f); if (r <= 0) { chosen = f; break; } }
          this.spawnWant(chosen, this.chooseWantType(chosen));
        }
      }
    }

    if (crossed(10)) {
      const lw: number[] = [];
      s.friends.filter(f => !f.gone).forEach(f => {
        const inc = T.drinkRate * this.c.traits[this.active(f)].tolerance * f.tolMul * (T.zoneDrink[f.zone] ?? 1) * (0.6 + this.rng() * 0.8);
        if (this.active(f) === 'lightweight') lw.push(inc);
        this.addDrunk(f, inc);
        if (f.zone === 'floor') this.addJoy(f, 0.15);
        if (this.active(f) === 'wallflower' && f.zone === 'table' && this.withActive('wallflower', [f.id]).some(o => o.zone === 'table')) this.addJoy(f, 0.1);
        if (f.joy <= -3 && !f.gone) this.goHome(f, 'reason.tears', 8, [[f.id, 'chat.leftWithoutBye']]);
      });
      if (lw.length > 1) { const mx = Math.max(...lw); this.withActive('lightweight').forEach(f => this.addDrunk(f, mx * 0.5)); }
      s.friends.filter(f => this.isHere(f) && this.stage(f) === 'wasted' && !f.want && this.avail(f)).forEach(f => { if (this.chance(0.12)) this.spawnWant(f, this.chance(0.5) ? 'sick' : 'lost'); });
    }

    if (s.t >= s.nextStranger) {
      s.nextStranger = s.t + 28 + this.rng() * 24;
      const live = this.liveStrangers();
      if (live.length >= 4) {
        const free = live.filter(x => !s.friends.some(f => f.want?.stranger === x.id));
        if (free.length) { const x = this.pick(free); x.left = true; if (x.kind) this.log(this.t('event.strangerLeaves', { s: x.name })); }
      } else this.addStranger();
    }

    if (this.withActive('spender').length >= 2 && s.t - s.lastRoundWar > 110) {
      const sp = this.withActive('spender'); const first = s.lastRoundWar === 0;
      s.lastRoundWar = s.t;
      this.log(this.t('event.roundWar', { names: sp.map(p => p.name).join(` ${this.t('word.and')} `) }));
      if (first) this.story(5, sp.map(p => p.id), [[sp[0].id, 'chat.roundWar']]);
      this.here().forEach(f => { this.addDrunk(f, 0.3); this.addJoy(f, 1); });
    }

    if (s.remix.state === 'waiting' && s.t >= s.remix.at - 15) { s.remix.state = 'teasing'; this.log(this.t('event.remixTease')); }
    if (s.remix.state === 'teasing' && s.t >= s.remix.at) {
      s.remix.state = 'playing'; s.remix.until = s.t + 20;
      const present = this.here(); const onFloor = present.filter(f => f.zone === 'floor');
      onFloor.forEach(f => this.addJoy(f, 2));
      if (onFloor.length === present.length && present.length >= 2) {
        this.story(10, onFloor.map(f => f.id), [[onFloor[0].id, 'chat.remixAll']], ['photo.remixAll', {}]);
        this.log(this.t('event.remixAll'));
        onFloor.forEach(f => this.fx(f.id, this.t('float.theMoment'), 'magic'));
      } else {
        this.log(onFloor.length ? this.t('event.remixSome', { names: onFloor.map(f => f.name).join(', ') }) : this.t('event.remixNone'));
        if (onFloor.length) this.story(5, onFloor.map(f => f.id), [[onFloor[0].id, 'chat.remixSome']]);
      }
    }
    if (s.remix.state === 'playing' && s.t >= s.remix.until) s.remix.state = 'done';

    if (s.t >= s.len || s.friends.every(f => f.gone)) this.end();
  }

  end() {
    const s = this.s;
    if (s.ended) return;
    s.ended = true;
    const left = s.friends.filter(f => !f.gone);
    left.forEach(f => {
      const others = left.filter(o => o.id !== f.id);
      f.home = f.drunk < 5 ? this.t('home.sober') : f.drunk < 7.5 ? this.t('home.tipsy')
        : others.length && this.chance(0.35) ? this.t('home.sofa', { name: this.pick(others).name }) : this.t('home.wasted');
    });
    this.log(this.t('event.lightsOn'));
  }

  /** Skip to 03:00 now. */
  endNow() { if (!this.s.ended) { this.s.t = this.s.len - 0.01; this.step(0.02); } }

  carry(): Carry { return { night: this.s.night, bonds: { ...this.s.bonds } }; }

  // ---------- morning after ----------
  private voice(f: Friend, text: string) {
    if (!this.chance(0.65) || /\p{Extended_Pictographic}\s*$/u.test(text)) return text;
    const v = this.c.voice[this.lang]?.[this.active(f)];
    if (!v) return text;
    let out = text;
    if (v.transform === 'upper') out = out.toUpperCase();
    if (v.transform === 'lower') out = out.toLowerCase().replace(/[!?.]+$/, '');
    if (v.transform === 'sentence') out = out.charAt(0).toUpperCase() + out.slice(1) + (/[.!?]$/.test(out) ? '' : '.');
    if (v.transform === 'typo') out = typo(out, this.rng);
    if (v.suffix?.length) out += this.pick(v.suffix);
    return out;
  }

  recap(): Recap {
    const s = this.s;
    const byId = (id: string) => s.friends.find(f => f.id === id)!;
    const seen = new Set<string>(), top: Story[] = [];
    [...s.stories].sort((a, b) => b.weight - a.weight || a.t - b.t).forEach(st => {
      const k = st.lines.map(l => l.text).join('|') || st.photo || '';
      if (top.length < 7 && !seen.has(k)) { seen.add(k); top.push(st); }
    });
    top.sort((a, b) => a.t - b.t);
    const msgs: Recap['msgs'] = [];
    const push = (from: string, text?: string, photo?: string, ids?: string[]) => msgs.push({ from, name: byId(from).name, text: text && this.voice(byId(from), text), photo, ids });
    const safe = ['reason.tookHome', 'reason.takenHome', 'reason.afterpartyTommy', 'reason.afterpartyAnyway', 'reason.afterpartyBoth'];
    const anyBad = s.friends.some(f => f.gone && !safe.includes(f.goneKey ?? ''));
    const carer = s.friends.find(f => ['mum', 'loyal', 'softie'].includes(f.traits[0])) ?? s.friends[0];
    push(carer.id, this.t(anyBad ? 'recap.openBad' : 'recap.openGood'));
    top.forEach(st => {
      if (st.photo) push(st.lines[0]?.from ?? st.ids[0], undefined, st.photo, st.ids);
      st.lines.forEach(l => push(l.from, l.text));
    });
    const dramas = s.friends.filter(f => f.traits.includes('drama'));
    if (dramas.length) { push(dramas[0].id, this.t('recap.drama1')); if (dramas.length > 1) push(dramas[1].id, this.t('recap.drama2')); }
    const hung = s.friends.filter(f => !f.gone && f.drunk >= 7);
    if (hung.length) push(this.pick(hung).id, this.t('recap.hangover'));
    const changes: { d: number; text: string }[] = [];
    for (let i = 0; i < s.friends.length; i++) for (let j = i + 1; j < s.friends.length; j++) {
      const a = s.friends[i], b = s.friends[j], k = [a.id, b.id].sort().join('|');
      const d = (s.bonds[k] ?? 0) - (s.bondStart[k] ?? 0);
      if (d >= 1.5) changes.push({ d, text: this.t('recap.closer', { a: a.name, b: b.name }) });
      if (d <= -1.5) changes.push({ d: -d + 0.5, text: this.t('recap.apart', { a: a.name, b: b.name }) });
    }
    return {
      night: s.night, msgs,
      changes: changes.sort((x, y) => y.d - x.d).slice(0, 4).map(c => c.text),
      home: s.friends.map(f => ({ name: f.name, how: f.gone ?? f.home ?? '' })),
    };
  }
}

function typo(t: string, rng: Rng) {
  const w = t.split(' ');
  for (let n = 0; n < 2; n++) {
    const i = Math.floor(rng() * w.length), x = w[i];
    if (x.length > 3) { const j = 1 + Math.floor(rng() * (x.length - 2)); w[i] = x.slice(0, j) + x[j + 1] + x[j] + x.slice(j + 2); }
  }
  return w.join(' ');
}


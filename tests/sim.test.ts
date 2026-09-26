import { describe, expect, it } from 'vitest';
import { loadNodeContent } from '../tools/node-content';
import { Sim, wentBadly, type CrewMember } from '../src/sim/engine';
import { Clock, replayNight, TICK } from '../src/sim/replay';
import { botStep } from '../src/sim/bot';
import { makeRng } from '../src/sim/rng';

const c = loadNodeContent();
const traits = Object.keys(c.traits);

function playNight(seed: number, policy: 'good' | 'idle' = 'good') {
  const r = makeRng(seed + 1000);
  const sim = new Sim(c, seed, { strictText: true });
  const crew: CrewMember[] = Array.from({ length: 5 }, (_, i) => ({ name: 'P' + i, traits: [traits[Math.floor(r() * traits.length)], traits[Math.floor(r() * traits.length)]], look: sim.randomLook() }));
  sim.newNight(crew);
  let g = 0;
  while (!sim.s.ended && g++ < 5000) { sim.step(0.25); botStep(sim, policy, r); sim.drainFx(); }
  return sim;
}

describe('simulation', () => {
  it('plays 300 random nights without errors or missing text', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const sim = playNight(seed, seed % 3 === 0 ? 'idle' : 'good');
      expect(sim.s.ended).toBe(true);
      expect(() => sim.recap()).not.toThrow();
    }
  });

  it('is deterministic: the same seed gives the same night', () => {
    const a = playNight(42).s.log.map(l => l.text).join('\n');
    const b = playNight(42).s.log.map(l => l.text).join('\n');
    expect(a).toBe(b);
  });

  it('replays a recorded night exactly from seed, crew and taps', () => {
    for (const seed of [3, 42, 99]) {
      const a = playNight(seed);
      const b = replayNight(new Sim(c, seed, { strictText: true }), JSON.parse(JSON.stringify(a.replay(0.25))));
      expect(b.s.log.map(l => l.text)).toEqual(a.s.log.map(l => l.text));
      expect(b.s.friends.map(f => f.gone)).toEqual(a.s.friends.map(f => f.gone));
    }
  });

  it('gives the same night at any frame rate and speed', () => {
    // Play in the fixed-tick clock with uneven frames and a speed change, the way the browser does.
    const r = makeRng(5);
    const sim = new Sim(c, 77);
    sim.newNight(Array.from({ length: 5 }, (_, i) => ({ name: 'P' + i, traits: [traits[i], traits[i + 5]], look: sim.randomLook() })));
    const clock = new Clock(sim);
    let g = 0;
    while (!sim.s.ended && g++ < 1e5) { clock.advance((0.004 + r() * 0.03) * (g > 2000 ? 4 : 1)); botStep(sim, 'good', r); }
    const again = replayNight(new Sim(c, 77), sim.replay(TICK));
    expect(again.s.log.map(l => l.text)).toEqual(sim.s.log.map(l => l.text));
    expect(again.s.steps).toBe(sim.s.steps);
  });

  it('stays roughly balanced for an attentive player', () => {
    let gone = 0;
    for (let seed = 1; seed <= 200; seed++) gone += playNight(seed).s.friends.filter(wentBadly).length;
    const perNight = gone / 200;
    // If this fails after a tuning change, run `npm run sim` and decide if the new number is intended.
    expect(perNight).toBeGreaterThan(0.5);
    expect(perNight).toBeLessThan(2.5);
  });

  it('carries relationships into the next night', () => {
    const sim = playNight(7);
    const next = new Sim(c, 8);
    next.newNight(sim.s.friends.map(f => ({ name: f.name, traits: f.traits, look: f.look })), sim.carry());
    expect(next.s.night).toBe(2);
    expect(next.s.bonds).toEqual(sim.s.bonds);
  });
});

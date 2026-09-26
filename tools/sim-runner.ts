// Plays many nights with an autopilot and prints balance numbers.
// Usage: npm run sim -- --nights 500 --seed 1 --policy good
import { appendFileSync } from 'node:fs';
import { loadNodeContent } from './node-content';
import { Sim, wentBadly, type CrewMember } from '../src/sim/engine';
import { botStep } from '../src/sim/bot';
import { makeRng } from '../src/sim/rng';

const arg = (name: string, def: string) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const nights = +arg('nights', '400'), seed0 = +arg('seed', '1'), policy = arg('policy', 'good') as 'good' | 'idle';

export function runBatch(n: number, seed: number, pol: 'good' | 'idle') {
  const c = loadNodeContent();
  const traits = Object.keys(c.traits);
  const stats = { nights: 0, gone: 0, clean: 0, moment: 0, drunk: 0, people: 0, reasons: {} as Record<string, number>, byTrait: {} as Record<string, [number, number]>, missing: new Set<string>() };
  for (let k = 0; k < n; k++) {
    const r = makeRng(seed * 7919 + k);
    const sim = new Sim(c, seed * 7919 + k);
    const crew: CrewMember[] = Array.from({ length: 5 }, (_, i) => ({ name: 'P' + i, traits: [traits[Math.floor(r() * traits.length)], traits[Math.floor(r() * traits.length)]], look: sim.randomLook() }));
    sim.newNight(crew);
    let g = 0;
    while (!sim.s.ended && g++ < 5000) { sim.step(0.25); botStep(sim, pol, r); sim.drainFx(); }
    const bad = sim.s.friends.filter(wentBadly);
    stats.nights++; stats.gone += bad.length; if (!bad.length) stats.clean++;
    if (sim.s.stories.some(st => st.weight === 10)) stats.moment++;
    sim.s.friends.forEach(f => {
      stats.drunk += f.drunk; stats.people++;
      const bt = (stats.byTrait[f.traits[0]] ??= [0, 0]); bt[0]++; if (bad.includes(f)) bt[1]++;
      if (f.goneKey) stats.reasons[f.goneKey] = (stats.reasons[f.goneKey] ?? 0) + 1;
    });
    sim.tx.missing.forEach(m => stats.missing.add(m));
  }
  return stats;
}

const isMain = process.argv[1]?.includes('sim-runner');
if (isMain) {
  const st = runBatch(nights, seed0, policy);
  const pct = (a: number) => `${Math.round(a / st.nights * 100)}%`;
  const lines = [
    `## Balance run: ${st.nights} nights, policy "${policy}", seed ${seed0}`,
    '',
    `| Measure | Value |`, `|---|---|`,
    `| Friends sent home badly, per night | ${(st.gone / st.nights).toFixed(2)} of 5 |`,
    `| Nights where nobody was sent home badly | ${pct(st.clean)} |`,
    `| Nights with the whole crew on the floor for the remix | ${pct(st.moment)} |`,
    `| Average drunk level at 03:00 | ${(st.drunk / st.people).toFixed(1)} of 10 |`,
    '',
    `| Sober trait | Sent home badly |`, `|---|---|`,
    ...Object.entries(st.byTrait).sort((a, b) => b[1][1] / b[1][0] - a[1][1] / a[1][0]).map(([t, [n, g]]) => `| ${t} | ${Math.round(g / n * 100)}% |`),
    '',
    `| Why people left | Per night |`, `|---|---|`,
    ...Object.entries(st.reasons).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `| ${k} | ${(v / st.nights).toFixed(2)} |`),
  ];
  if (st.missing.size) lines.push('', `Missing text keys: ${[...st.missing].join(', ')}`);
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}

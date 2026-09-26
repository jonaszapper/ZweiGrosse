import type { Sim } from './engine';
import type { Skill } from '../content/schema';

/**
 * A simple autopilot player used by the balance runner and tests.
 * "good" helps the most urgent want with the best-suited friend and herds everyone to the remix.
 * "idle" does nothing, which shows how a night goes when nobody steers.
 */
export function botStep(sim: Sim, policy: 'good' | 'idle', rng: () => number) {
  if (policy === 'idle' || rng() > 0.25) return;
  const s = sim.s;
  const wants = s.friends.filter(f => f.want && sim.isHere(f) && s.t >= f.busy);
  const helpers = s.friends.filter(f => sim.canAct(f) && !f.want);
  if (wants.length && helpers.length) {
    const t = wants.sort((a, b) => b.want!.level - a.want!.level)[0];
    const def = sim.c.wants[t.want!.type];
    const key: Skill = def.key ?? def.duo![1];
    const h = helpers.filter(x => x.id !== t.id).sort((a, b) => sim.skill(b, key) - sim.skill(a, key))[0];
    if (h) sim.sendTo(h.id, t.id);
  }
  if (s.remix.state === 'teasing') s.friends.filter(f => sim.canAct(f)).forEach(f => sim.sendPlace(f.id, 'floor'));
}

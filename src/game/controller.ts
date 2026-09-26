import type { Place, Sim } from '../sim/engine';
import { Text } from '../sim/text';

/**
 * The player's side of the night: what is selected, what the hint says, speed and pause.
 * Shared by the Phaser scene (taps) and the HUD (buttons, hint text).
 */
export class Controller {
  selected: string | null = null;
  speed = 2;
  paused = false;
  showNumbers = false;
  private hintMsg = '';
  private hintUntil = 0;
  readonly ui: Text;

  constructor(public sim: Sim) {
    this.ui = new Text(sim.c.text[sim.lang], Math.random);
  }

  private say(key: string, vars: Record<string, string> = {}) { this.hintMsg = this.ui.t(key, vars); this.hintUntil = performance.now() + 2600; }

  tapPerson(id: string) {
    const sim = this.sim, s = sim.s;
    if (s.ended) return;
    const f = sim.friend(id);
    if (!this.selected) {
      if (!f) {
        const x = s.strangers.find(p => p.id === id);
        return x?.kind ? this.say('ui.hint.strangerEnc', { name: x.name, tag: x.tag }) : this.say('ui.hint.stranger');
      }
      if (f.gone) return this.say('ui.hint.gone', { name: f.name, reason: f.gone });
      if (f.zone === 'out') return this.say('ui.hint.out', { name: f.name });
      if (f.want && (f.want.type === 'lost' || f.want.type === 'sick')) return this.say('ui.hint.needsHelp', { name: f.name, want: f.want.text });
      if (s.t < f.busy) return this.say('ui.hint.busy', { name: f.name });
      this.selected = id;
      return;
    }
    if (this.selected === id) { this.selected = null; return; }
    const helper = this.selected; this.selected = null;
    if (f && (f.gone || f.zone === 'out')) return this.say('ui.hint.notHere', { name: f.name });
    if (f && f.want && s.t < f.busy) return this.say('ui.hint.busy', { name: f.name });
    sim.sendTo(helper, id);
  }

  tapPlace(place: Place | 'none') {
    const s = this.sim.s;
    if (s.ended) return;
    if (!this.selected) {
      if (place === 'bush') this.say(s.bushEmpty ? 'ui.hint.bushEmpty' : 'ui.hint.bush');
      if (place === 'anders') this.say('ui.hint.anders');
      if (place === 'simon') this.say('ui.hint.simon');
      return;
    }
    const helper = this.selected; this.selected = null;
    if (place === 'none') return;
    if (place === 'bush' && s.bushEmpty) this.say('ui.hint.bushEmpty');
    this.sim.sendPlace(helper, place);
  }

  hint(): string {
    if (performance.now() < this.hintUntil) return this.hintMsg;
    const sim = this.sim;
    const f = this.selected ? sim.friend(this.selected) : undefined;
    if (f && sim.canAct(f)) {
      return this.ui.t('ui.hint.selected', { name: f.name, trait: sim.activeName(f), stage: sim.tx.t(`stage.${sim.stage(f)}`), want: f.want ? ' ' + f.want.text : '' });
    }
    if (this.selected) this.selected = null;
    const open = sim.s.friends.filter(x => x.want && !x.gone);
    return open.length
      ? this.ui.t('ui.hint.openWants', { list: open.map(x => `${x.name} ${this.ui.t(`want.label.${x.want!.type}`)}`).join(', ') })
      : this.ui.t('ui.hint.quiet');
  }
}

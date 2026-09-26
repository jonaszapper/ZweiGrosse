import { useMemo, useState } from 'preact/hooks';
import type { Content } from '../content/load';
import { Sim, type Carry, type CrewMember, type Recap } from '../sim/engine';
import { Text } from '../sim/text';
import { Controller } from '../game/controller';
import { preset } from './presets';
import { CrewBuilder } from './CrewBuilder';
import { Night } from './Night';
import { Morning } from './Morning';

type Screen = { id: 'setup' } | { id: 'night'; ctl: Controller } | { id: 'morning'; recap: Recap; sim: Sim };

/** Reads ?seed=123 from the address bar, so a reported night can be replayed exactly. */
function seedFromUrl() { const v = new URLSearchParams(location.search).get('seed'); return v ? Number(v) : null; }

export function App({ content }: { content: Content }) {
  const ui = useMemo(() => new Text(content.text.da, Math.random), [content]);
  const looker = useMemo(() => new Sim(content, Date.now()), [content]);
  const [crew, setCrew] = useState<CrewMember[]>(() => preset('usual', Object.keys(content.traits), () => looker.randomLook()));
  const [screen, setScreen] = useState<Screen>({ id: 'setup' });
  const [carry, setCarry] = useState<Carry | undefined>();

  const start = (keep?: Carry) => {
    const seed = seedFromUrl() ?? Math.floor(Math.random() * 1e9);
    const sim = new Sim(content, seed);
    sim.newNight(crew, keep);
    setScreen({ id: 'night', ctl: new Controller(sim) });
  };

  if (screen.id === 'night') return <Night ctl={screen.ctl} onEnd={() => { const sim = screen.ctl.sim; setCarry(sim.carry()); setScreen({ id: 'morning', recap: sim.recap(), sim }); }} />;
  if (screen.id === 'morning') return <Morning ui={ui} recap={screen.recap} sim={screen.sim} onAgain={() => start(carry)} onNewCrew={() => { setCarry(undefined); setScreen({ id: 'setup' }); }} />;
  return <CrewBuilder content={content} ui={ui} crew={crew} setCrew={setCrew} newLook={() => looker.randomLook()} onStart={() => { setCarry(undefined); start(); }} />;
}

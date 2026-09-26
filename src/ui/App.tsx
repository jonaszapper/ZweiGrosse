import { useMemo, useState } from 'preact/hooks';
import type { Content } from '../content/load';
import { Sim, type Carry, type CrewMember, type Recap } from '../sim/engine';
import { Text } from '../sim/text';
import { Controller } from '../game/controller';
import { decodeReplay } from '../game/replayLink';
import type { Replay } from '../sim/replay';
import { preset } from './presets';
import { CrewBuilder } from './CrewBuilder';
import { Night } from './Night';
import { Morning } from './Morning';

type Screen = { id: 'setup' } | { id: 'night'; ctl: Controller } | { id: 'morning'; recap: Recap; sim: Sim };

/**
 * The address bar can hold `?replay=<code>` (plays a recorded night exactly, from the replay link in the footer)
 * or `?seed=123` (starts a night with that seed; with a different crew or other taps it plays out differently).
 * Both apply to the first night after the page loads only.
 */
const params = new URLSearchParams(location.search);
const urlReplay: Replay | null = params.get('replay') ? decodeReplay(params.get('replay')!) : null;
let urlSeed: number | null = Number.isFinite(Number(params.get('seed'))) && params.get('seed') ? Number(params.get('seed')) : null;

export function App({ content }: { content: Content }) {
  const ui = useMemo(() => new Text(content.text.da, Math.random), [content]);
  const looker = useMemo(() => new Sim(content, Date.now()), [content]);
  const [crew, setCrew] = useState<CrewMember[]>(() => urlReplay?.crew ?? preset('usual', Object.keys(content.traits), () => looker.randomLook()));
  const [screen, setScreen] = useState<Screen>(() => {
    if (!urlReplay) return { id: 'setup' };
    const sim = new Sim(content, urlReplay.seed);
    sim.newNight(urlReplay.crew, urlReplay.carry);
    return { id: 'night', ctl: new Controller(sim, urlReplay) };
  });
  const [carry, setCarry] = useState<Carry | undefined>();

  const start = (keep?: Carry) => {
    const seed = urlSeed ?? Math.floor(Math.random() * 1e9);
    urlSeed = null;
    const sim = new Sim(content, seed);
    sim.newNight(crew, keep);
    setScreen({ id: 'night', ctl: new Controller(sim) });
  };

  if (screen.id === 'night') return <Night ctl={screen.ctl} onEnd={() => { const sim = screen.ctl.sim; setCarry(sim.carry()); setScreen({ id: 'morning', recap: sim.recap(), sim }); }} />;
  if (screen.id === 'morning') return <Morning ui={ui} recap={screen.recap} sim={screen.sim} onAgain={() => start(carry)} onNewCrew={() => { setCarry(undefined); setScreen({ id: 'setup' }); }} />;
  return <CrewBuilder content={content} ui={ui} crew={crew} setCrew={setCrew} newLook={() => looker.randomLook()} onStart={() => { setCarry(undefined); start(); }} />;
}

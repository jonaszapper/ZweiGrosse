import type { Recap, Sim } from '../sim/engine';
import type { Text } from '../sim/text';
import { spriteUrl } from './sprites';

/** The morning-after group chat: the night's best moments, told by the crew. */
export function Morning({ ui, recap, sim, onAgain, onNewCrew }: { ui: Text; recap: Recap; sim: Sim; onAgain: () => void; onNewCrew: () => void }) {
  const byId = (id: string) => sim.s.friends.find(f => f.id === id)!;
  let prev = '';
  return (
    <section class="wrap">
      <div class="phone">
        <header><h2>{ui.t('ui.morning.chatName')}</h2><p>{ui.t('ui.morning.title', { n: String(recap.night) })}</p></header>
        <div class="msgs">
          {recap.msgs.map(m => {
            const f = byId(m.from), cont = prev === m.from; prev = m.from;
            return (
              <div class={`msg${cont ? ' cont' : ''}`}>
                <div class="face"><img src={spriteUrl(sim.c, f.look, f.joy >= 1 ? 'happy' : f.joy <= -1 ? 'sad' : 'neutral')} alt="" /></div>
                <div class="body">
                  <div class="who">{m.name}</div>
                  {m.photo
                    ? <div class="photo"><div class="pic">{(m.ids ?? []).map(id => <img src={spriteUrl(sim.c, byId(id).look, 'happy', 'tipsy')} alt="" />)}</div><div class="cap">{m.photo}</div></div>
                    : <div class="txt">{m.text}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div class="notes">
          {recap.changes.length > 0 && <><h3>{ui.t('ui.morning.changes')}</h3><ul>{recap.changes.map(c => <li>{c}</li>)}</ul></>}
          <h3>{ui.t('ui.morning.home')}</h3>
          <ul>{recap.home.map(h => <li><b>{h.name}</b> {h.how}.</li>)}</ul>
        </div>
      </div>
      <div class="actions">
        <button class="btn go" onClick={onAgain}>{ui.t('ui.morning.again')}</button>
        <button class="btn blue" onClick={onNewCrew}>{ui.t('ui.morning.newCrew')}</button>
      </div>
    </section>
  );
}

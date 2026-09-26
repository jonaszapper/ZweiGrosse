import type { Content } from '../content/load';
import type { Look } from '../content/schema';
import type { CrewMember } from '../sim/engine';
import type { Text } from '../sim/text';
import { NAMES, PRESET_IDS, preset } from './presets';
import { spriteUrl } from './sprites';

interface Props { content: Content; ui: Text; crew: CrewMember[]; setCrew: (c: CrewMember[]) => void; newLook: () => Look; onStart: () => void }

export function CrewBuilder({ content, ui, crew, setCrew, newLook, onStart }: Props) {
  const traits = Object.keys(content.traits);
  const tr = (id: string) => content.text.da[`trait.${id}.name`] as string;
  const update = (i: number, patch: Partial<CrewMember>) => setCrew(crew.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const options = (sel: string) => traits.map(id => <option value={id} selected={id === sel}>{tr(id)}</option>);

  return (
    <section class="wrap">
      <h1 class="title">{ui.t('ui.title')}</h1>
      <p class="lede">{ui.t('ui.lede')}</p>
      <div class="win">
        <div class="crew">
          {crew.map((m, i) => (
            <div class="mate" key={i}>
              <button class="av" aria-label={ui.t('ui.restyle', { name: m.name })} onClick={() => update(i, { look: newLook() })}>
                <img src={spriteUrl(content, m.look)} alt="" />
              </button>
              <div class="fields">
                <input value={m.name} maxLength={12} aria-label={ui.t('ui.name')} onInput={e => update(i, { name: (e.target as HTMLInputElement).value.trim() || ui.t('ui.friend') })} />
                <div class="row2">
                  <label>{ui.t('ui.sober')}<select onChange={e => update(i, { traits: [(e.target as HTMLSelectElement).value, m.traits[1]] })}>{options(m.traits[0])}</select></label>
                  <label>{ui.t('ui.afterFew')}<select onChange={e => update(i, { traits: [m.traits[0], (e.target as HTMLSelectElement).value] })}>{options(m.traits[1])}</select></label>
                </div>
              </div>
              <button class="x" aria-label={ui.t('ui.remove', { name: m.name })} disabled={crew.length <= 3} onClick={() => setCrew(crew.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
        <div class="presets">
          <button class="btn small blue" disabled={crew.length >= 6} onClick={() => setCrew([...crew, { name: NAMES.find(n => !crew.some(m => m.name === n)) ?? ui.t('ui.friend'), traits: ['charmer', 'party'], look: newLook() }])}>{ui.t('ui.addFriend')}</button>
          {PRESET_IDS.map(id => <button class="btn small" onClick={() => setCrew(preset(id, traits, newLook))}>{ui.t(`ui.presets.${id}`)}</button>)}
        </div>
        <button class="btn go" onClick={onStart}>{ui.t('ui.start')}</button>
      </div>
      <details class="glossary win">
        <summary>{ui.t('ui.glossary')}</summary>
        <p class="small">{ui.t('ui.glossaryIntro')}</p>
        <dl>{traits.map(id => <><dt>{tr(id)}</dt><dd>{content.text.da[`trait.${id}.desc`] as string}</dd></>)}</dl>
      </details>
    </section>
  );
}

import { useEffect, useRef, useState } from 'preact/hooks';
import * as Phaser from 'phaser';
import type { Controller } from '../game/controller';
import { BarScene, VIEW_H, VIEW_W } from '../scenes/BarScene';

/** The night: a Phaser canvas for the bar, with the clock and speed on top and the hint and log below. */
export function Night({ ctl, onEnd }: { ctl: Controller; onEnd: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const res = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current!,
      width: VIEW_W * res,
      height: VIEW_H * res,
      pixelArt: true,
      backgroundColor: '#2A1B3F',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
      banner: false,
    });
    game.scene.add('bar', BarScene, true, { controller: ctl, onEnd, resolution: res });
    // Handy in the browser console while developing: zg.sim.s shows the whole night.
    (window as unknown as { zg: Controller }).zg = ctl;
    const iv = setInterval(() => tick(n => n + 1), 150);
    return () => { clearInterval(iv); game.destroy(true); };
  }, [ctl]);

  const sim = ctl.sim, s = sim.s, ui = ctl.ui;
  const phase = ctl.paused ? ui.t('ui.phase.paused') : ui.t(`ui.phase.${sim.phase()}`);
  const log = s.log.slice(-4).reverse();

  return (
    <section class="night">
      <header class="hud">
        <span class="clock">{sim.clock()}</span>
        <span class="phase">{phase}</span>
        <div class="speed" role="group">
          <button class="btn small" aria-label={ui.t('ui.phase.paused')} onClick={() => { ctl.paused = !ctl.paused; tick(n => n + 1); }}>{ctl.paused ? '▶' : '❚❚'}</button>
          {[1, 2, 4].map(v => <button class="btn small" aria-pressed={ctl.speed === v} onClick={() => { ctl.speed = v; tick(n => n + 1); }}>{v}×</button>)}
        </div>
      </header>
      <div class="stage" ref={host} />
      <div class="hint win">{ctl.hint()}</div>
      <ul class="log win">
        {log.map(l => <li><time>{l.clock}</time>{l.text}{ctl.showNumbers && l.math ? <span class="m">{l.math}</span> : null}</li>)}
      </ul>
      <footer class="foot">
        <button class="btn small blue" aria-pressed={ctl.showNumbers} onClick={() => { ctl.showNumbers = !ctl.showNumbers; tick(n => n + 1); }}>{ui.t(ctl.showNumbers ? 'ui.hideNumbers' : 'ui.showNumbers')}</button>
        <span class="seed">{ui.t('ui.seed', { seed: String(s.seed) })}</span>
        <button class="btn small" onClick={() => sim.endNow()}>{ui.t('ui.endNight')}</button>
      </footer>
    </section>
  );
}

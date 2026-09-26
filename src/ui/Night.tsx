import { useEffect, useRef, useState } from 'preact/hooks';
import * as Phaser from 'phaser';
import type { Controller } from '../game/controller';
import { BarScene, VIEW_W, viewHeight } from '../scenes/BarScene';
import { PAL } from '../game/palette';
import { copyReplayLink } from '../game/replayLink';

/** Waits for the web fonts (and the emoji font) so the canvas never draws text in a fallback font. Gives up after 1.5 s. */
function fontsReady(icons: string[]) {
  const loads = [document.fonts.load('bold 10px "M PLUS Rounded 1c"'), document.fonts.load(`14px "Noto Color Emoji"`, icons.join(''))];
  return Promise.race([Promise.all(loads).catch(() => undefined), new Promise(r => setTimeout(r, 1500))]);
}

/**
 * The night fills the screen: clock and speed on top, the bar in the middle, and one panel below
 * with the hint and the latest lines of the log. Tap the log to read the whole night so far.
 * The bar's height adapts to the space left (see `viewHeight`), so nothing needs scrolling on a phone.
 */
export function Night({ ctl, onEnd }: { ctl: Controller; onEnd: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);
  const [height, setHeight] = useState(0);
  const [logOpen, setLogOpen] = useState(false);

  // Measure the stage. Only a real change of shape (rotation, a browser bar) rebuilds the canvas.
  useEffect(() => {
    const el = host.current!;
    let timer = 0;
    const measure = () => { const r = el.getBoundingClientRect(); setHeight(h => { const n = viewHeight(r.width, r.height); return Math.abs(n - h) >= 16 ? n : h; }); };
    const ro = new ResizeObserver(() => { clearTimeout(timer); timer = window.setTimeout(measure, 150); });
    ro.observe(el); measure();
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!height) return;
    let game: Phaser.Game | null = null, dead = false;
    const res = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    fontsReady(Object.values(ctl.sim.c.wants).map(w => w.icon)).then(() => {
      if (dead) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current!,
        width: VIEW_W * res,
        height: height * res,
        pixelArt: true,
        backgroundColor: PAL.night,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, expandParent: false },
        banner: false,
      });
      game.scene.add('bar', BarScene, true, { controller: ctl, onEnd, resolution: res, height });
    });
    return () => { dead = true; game?.destroy(true); };
  }, [ctl, height]);

  useEffect(() => {
    // Handy in the browser console while developing: zg.sim.s shows the whole night.
    (window as unknown as { zg: Controller }).zg = ctl;
    const iv = setInterval(() => tick(n => n + 1), 150);
    return () => clearInterval(iv);
  }, [ctl]);

  const sim = ctl.sim, s = sim.s, ui = ctl.ui;
  const phase = ctl.paused ? ui.t('ui.phase.paused') : ui.t(`ui.phase.${sim.phase()}`);
  const line = (l: typeof s.log[number]) => <li><time>{l.clock}</time>{l.text}{ctl.showNumbers && l.math ? <span class="m">{l.math}</span> : null}</li>;
  const toggle = () => setLogOpen(o => !o);

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
      <div class="talk win">
        <p class="hint">{ctl.hint()}</p>
        <ul class="log" role="button" tabIndex={0} aria-expanded={logOpen} aria-label={ui.t(logOpen ? 'ui.logClose' : 'ui.logOpen')}
          onClick={toggle} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}>
          {s.log.slice(-2).reverse().map(line)}
        </ul>
        {/* The log opens over the bar, so the stage keeps its size. It shows what fits, newest first: a scrolling box over the canvas blanks it in some browsers. */}
        {logOpen && <ul class="log full" onClick={toggle}>{s.log.slice(-20).reverse().map(line)}</ul>}
      </div>
      <footer class="foot">
        <button class="btn small blue" aria-pressed={ctl.showNumbers} onClick={() => { ctl.showNumbers = !ctl.showNumbers; tick(n => n + 1); }}>{ui.t(ctl.showNumbers ? 'ui.hideNumbers' : 'ui.showNumbers')}</button>
        <button class="seed" title={ui.t('ui.copyReplay')} onClick={async () => { if (await copyReplayLink(sim.replay(), ui.t('ui.replayPrompt'))) ctl.say('ui.replayCopied'); }}>{ui.t('ui.seed', { seed: String(s.seed) })}</button>
        <button class="btn small" disabled={ctl.replaying} onClick={() => ctl.endNight()}>{ui.t('ui.endNight')}</button>
      </footer>
    </section>
  );
}

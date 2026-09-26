import * as Phaser from 'phaser';
import type { Controller } from '../game/controller';
import { INK, PAL } from '../game/palette';
import type { Friend, Person, Place, Stranger } from '../sim/engine';
import type { Zone } from '../content/schema';
import { compose, spriteKey, toCanvas, type Mood } from '../sprites/compose';
import type { Look } from '../content/schema';

/**
 * Logical size. The bar is always 360 wide; its height stretches between 480 and 640 to fill the space
 * the phone gives it, so it never shrinks into a letterbox. The camera zooms it up for sharp text.
 */
export const VIEW_W = 360, MIN_H = 480, MAX_H = 640;

/** The logical height that best fills a stage of this size on screen. */
export function viewHeight(w: number, h: number) {
  if (!w || !h) return MAX_H;
  return Phaser.Math.Clamp(Math.floor((VIEW_W * h) / w / 8) * 8, MIN_H, MAX_H);
}

const G = 4;            // gap between areas
const FONT = '"M PLUS Rounded 1c", system-ui, sans-serif';
const FLOAT_COLORS: Record<string, string> = { nailed: '#FFD83A', fine: '#FFF2D6', backfire: '#9CC7FF', chaos: '#FF5B6E', flip: '#7BF0B6', magic: '#FF9DE0' };

interface ZoneRect {
  id: Zone; x: number; y: number; w: number; h: number; place: Place | 'none'; label: string;
  /** Where feet stand in each row, from the top of the area. */
  rows: number[];
  /** Sprite scale, and the horizontal space a person wants and at least needs. */
  scale: number; step: number; minStep: number;
  tags: boolean;
}
interface Actor {
  c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; ring: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Container; bubbleBg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Text; bubbleLevel: number;
  seed: number; key: string; fullName: string; nameWidth: number; fullTag: string; tagWidth: number; zone: Zone | '';
}

export class BarScene extends Phaser.Scene {
  private ctl!: Controller;
  private onEnd!: () => void;
  private res = 1;
  private H = MAX_H;
  private zones = {} as Record<Zone, ZoneRect>;
  private actors = new Map<string, Actor>();
  private spots: Phaser.GameObjects.Ellipse[] = [];
  private banner!: Phaser.GameObjects.Text;
  private bush!: Phaser.GameObjects.Container;
  private bushBottle!: Phaser.GameObjects.Rectangle;
  private endTimer = -1;

  constructor() { super('bar'); }

  init(data: { controller: Controller; onEnd: () => void; resolution: number; height: number }) {
    this.ctl = data.controller; this.onEnd = data.onEnd; this.res = data.resolution; this.H = data.height;
    this.actors = new Map(); this.spots = []; this.endTimer = -1;
  }

  private get sim() { return this.ctl.sim; }
  private ui(key: string, vars?: Record<string, string>) { return this.ctl.ui.t(key, vars); }
  private text(x: number, y: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    return this.add.text(x, y, s, { fontFamily: FONT, resolution: this.res, ...style });
  }

  // ---------- layout ----------

  /** The six areas. Top and bottom rows keep their size; the floor and the table get whatever height is left. */
  private layout(H: number): Record<Zone, ZoneRect> {
    const extra = H - MIN_H;
    const topH = 128 + Math.round(extra * 0.15), botH = 84 + Math.round(extra * 0.1);
    const mid = H - topH - botH - G * 5, floorH = Math.ceil(mid / 2), tableH = mid - floorH;
    const half = (VIEW_W - G * 3) / 2, right = G * 2 + half, full = VIEW_W - G * 2;
    const y2 = G * 2 + topH, y3 = y2 + floorH + G, y4 = y3 + tableH + G;
    // Big areas get a second row when they are tall enough for one.
    const rowsFor = (h: number) => { const r = [80]; while (r[r.length - 1] + 66 + 28 <= h - 2) r.push(r[r.length - 1] + 66); return r; };
    const Z = (id: Zone, x: number, y: number, w: number, h: number, place: Place | 'none', rows: number[], scale: number, step: number, minStep: number, tags: boolean): ZoneRect =>
      ({ id, x, y, w, h, place, label: this.ui(`ui.zone.${id}`), rows, scale, step, minStep, tags });
    return {
      bar: Z('bar', G, G, half, topH, 'simon', [topH - 30], 2, 56, 44, true),
      door: Z('door', right, G, half, topH, 'anders', [topH - 30], 2, 56, 44, true),
      floor: Z('floor', G, y2, full, floorH, 'floor', rowsFor(floorH), 2, 58, 44, true),
      table: Z('table', G, y3, full, tableH, 'table', rowsFor(tableH), 2, 58, 44, true),
      out: Z('out', G, y4, half, botH, 'none', [botH - 18], 1.5, 44, 34, false),
      gone: Z('gone', right, y4, half, botH, 'none', [botH - 16], 1.2, 34, 26, false),
    };
  }

  /** Where the i-th of n people in an area stands. Crowds squeeze together before they spill into a second row. */
  private slot(z: ZoneRect, i: number, n: number) {
    const inner = z.w - 12;
    const perRowMax = Math.max(1, Math.floor(inner / z.minStep));
    const rows = Math.min(z.rows.length, Math.ceil(n / perRowMax));
    const perRow = Math.ceil(n / rows);
    const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - row * perRow);
    const step = Math.min(z.step, inner / perRow);
    const x0 = z.x + 6 + (inner - step * inRow) / 2; // centre each row
    return { x: x0 + step * (col + 0.5), y: z.y + z.rows[row], step };
  }

  // ---------- drawing the room ----------

  create() {
    const cam = this.cameras.main;
    cam.setZoom(this.res).centerOn(VIEW_W / 2, this.H / 2);
    cam.setBackgroundColor(PAL.night);
    this.zones = this.layout(this.H);

    for (const z of Object.values(this.zones)) {
      const r = this.add.rectangle(z.x, z.y, z.w, z.h, this.fillFor(z.id)).setOrigin(0).setStrokeStyle(2, PAL.edge, 0.9);
      this.drawProps(z);
      this.text(z.x + 7, z.y + 4, z.label, { fontSize: '12px', color: INK.label, fontStyle: 'bold', stroke: INK.outline, strokeThickness: 3 }).setAlpha(0.95).setDepth(2);
      r.setInteractive().on('pointerdown', () => this.ctl.tapPlace(z.place));
    }

    const fz = this.zones.floor;
    this.spots = PAL.remix.map(col => this.add.ellipse(fz.x + fz.w / 2, fz.y + fz.h / 2, 120, 60, col, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(1));
    this.banner = this.text(VIEW_W / 2, fz.y + fz.h - 6, '', { fontSize: '13px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#FF6F91', padding: { x: 8, y: 3 } })
      .setOrigin(0.5, 1).setVisible(false).setDepth(900);

    this.bush = this.makeBush();

    // Simon and Anders are fixed characters in the first spot of their areas.
    this.addNpc('npc-simon', { skin: '#F2C29B', hair: '#2B1D14', hairStyle: 'spiky', outfit: '#1F1F28', accessory: 'headphones' }, this.ui('ui.npc.simon'), this.ui('ui.npc.simonTag'), 'simon');
    this.addNpc('npc-anders', { skin: '#E8B48E', hair: '#000', hairStyle: 'none', outfit: '#15151C', accessory: 'shades', body: 'broad' }, this.ui('ui.npc.anders'), this.ui('ui.npc.andersTag'), 'anders');
  }

  private fillFor(id: Zone) {
    return { bar: PAL.room, door: PAL.door, floor: PAL.floorA, table: PAL.room, out: PAL.street, gone: PAL.gone }[id];
  }

  /** Static scenery for each area. Drawn behind people, kept simple and flat like the sprites. */
  private drawProps(z: ZoneRect) {
    const g = this.add.graphics().setDepth(1);
    const feet = z.y + z.rows[0];
    if (z.id === 'bar') {
      // back shelf with bottles, and the counter at waist height
      g.fillStyle(PAL.woodDark).fillRect(z.x + 64, z.y + 22, z.w - 72, 4);
      const bottles = [0x7bb36a, 0xc9a44a, 0x8a4a9c, 0x5a8fc9, 0xd06a4a, 0x7bb36a, 0xe0e0c0];
      for (let i = 0; i * 12 + 70 < z.w - 12; i++) {
        g.fillStyle(bottles[i % bottles.length]).fillRect(z.x + 70 + i * 12, z.y + 10, 5, 12).fillRect(z.x + 71 + i * 12, z.y + 6, 3, 4);
      }
      g.fillStyle(PAL.wood).fillRect(z.x + 2, feet - 26, z.w - 4, 16);
      g.fillStyle(PAL.woodLight).fillRect(z.x + 2, feet - 26, z.w - 4, 3);
      for (let i = 0; i < 3; i++) g.fillStyle(PAL.brass).fillRect(z.x + z.w - 54 + i * 14, feet - 36, 4, 10);
    }
    if (z.id === 'door') {
      // the doorway, with warm light from the street, and a little rope
      const dx = z.x + z.w - 58, dy = z.y + 20, dw = 34, dh = feet - 8 - dy;
      g.fillStyle(PAL.woodDark).fillRect(dx - 4, dy - 4, dw + 8, dh + 4);
      g.fillStyle(PAL.doorLight, 0.9).fillRect(dx, dy, dw, dh);
      g.fillStyle(0xffe2b0, 0.9).fillRect(dx + 4, dy + 4, dw - 8, 10);
      g.fillStyle(PAL.doorLight, 0.12).fillEllipse(dx + dw / 2, feet - 4, 90, 16);
      g.fillStyle(PAL.brass).fillRect(z.x + 70, feet - 30, 3, 22).fillRect(z.x + 110, feet - 30, 3, 22);
      g.lineStyle(2, 0xb3263a).lineBetween(z.x + 72, feet - 26, z.x + 111, feet - 26);
    }
    if (z.id === 'floor') {
      const s = 18;
      for (let y = z.y; y < z.y + z.h; y += s) for (let x = z.x; x < z.x + z.w; x += s) {
        g.fillStyle(((x - z.x) / s + (y - z.y) / s) % 2 ? PAL.floorB : PAL.floorA);
        g.fillRect(x, y, Math.min(s, z.x + z.w - x), Math.min(s, z.y + z.h - y));
      }
      // disco ball
      const bx = z.x + z.w / 2, by = z.y + 26;
      g.lineStyle(1, 0xaaaaaa).lineBetween(bx, z.y, bx, by - 8);
      g.fillStyle(0xc9c9d6).fillCircle(bx, by, 8);
      g.fillStyle(0xffffff).fillRect(bx - 4, by - 4, 3, 3).fillRect(bx + 2, by, 2, 2);
    }
    if (z.id === 'table') {
      // a lamp over a long table, glasses on it
      const lx = z.x + z.w / 2;
      g.fillStyle(PAL.lamp, 0.05).fillEllipse(lx, z.y + z.h * 0.55, z.w * 0.8, z.h * 0.8);
      g.fillStyle(PAL.lamp, 0.05).fillEllipse(lx, z.y + z.h * 0.55, z.w * 0.5, z.h * 0.5);
      g.lineStyle(1, 0x888888).lineBetween(lx, z.y, lx, z.y + 8);
      g.fillStyle(PAL.woodDark).fillTriangle(lx - 12, z.y + 16, lx + 12, z.y + 16, lx, z.y + 7);
      g.fillStyle(PAL.lamp).fillRect(lx - 3, z.y + 16, 6, 3);
      for (const ty of z.rows) {
        g.fillStyle(PAL.wood).fillRect(z.x + 14, z.y + ty - 24, z.w - 28, 14);
        g.fillStyle(PAL.woodLight).fillRect(z.x + 14, z.y + ty - 24, z.w - 28, 3);
        for (let i = 0; i < 5; i++) g.fillStyle(PAL.lamp, 0.85).fillRect(z.x + 40 + i * 64, z.y + ty - 31, 5, 7);
      }
    }
    if (z.id === 'out') {
      // brick wall and a wall lamp
      for (let row = 0; z.y + 6 + row * 8 < feet - 30; row++) {
        for (let x = z.x + 4 + (row % 2) * 10; x < z.x + z.w - 16; x += 20) g.fillStyle(PAL.brick).fillRect(x, z.y + 20 + row * 8, 16, 5);
      }
      g.fillStyle(PAL.lamp).fillRect(z.x + z.w - 20, z.y + 12, 6, 6);
      g.fillStyle(PAL.lamp, 0.06).fillCircle(z.x + z.w - 17, z.y + 15, 20);
    }
    if (z.id === 'gone') {
      // night sky: a moon and a few stars
      g.fillStyle(0xfff4c2).fillCircle(z.x + z.w - 20, z.y + 16, 7);
      g.fillStyle(PAL.gone).fillCircle(z.x + z.w - 17, z.y + 14, 6);
      for (const [sx, sy] of [[90, 10], [120, 26], [70, 30], [140, 8]]) g.fillStyle(0xffffff, 0.7).fillRect(z.x + sx, z.y + sy, 2, 2);
    }
  }

  /** The bush outside, where the bottles are hidden. A 44 by 44 tap target. */
  private makeBush() {
    const dz = this.zones.door;
    const g = this.add.graphics();
    g.fillStyle(PAL.leafDark).fillCircle(-8, 2, 10).fillCircle(8, 2, 10);
    g.fillStyle(PAL.leaf).fillCircle(0, -6, 12).fillCircle(-10, 0, 8).fillCircle(10, 0, 8);
    g.fillStyle(0x9fd8a8).fillRect(-4, -12, 3, 3).fillRect(6, -6, 2, 2);
    const bottle = this.bushBottle = this.add.rectangle(4, -14, 4, 9, 0xd6e8f0).setOrigin(0.5, 1);
    const c = this.add.container(dz.x + dz.w - 20, dz.y + dz.h - 16, [g, bottle]).setSize(44, 44).setDepth(3);
    c.setInteractive(new Phaser.Geom.Rectangle(-22, -30, 44, 44), Phaser.Geom.Rectangle.Contains);
    c.on('pointerdown', () => this.ctl.tapPlace('bush'));
    return c;
  }

  // ---------- people ----------

  private texture(look: Look, mood: Mood, stage: 'sober' | 'tipsy' | 'wasted') {
    const key = spriteKey(look, mood, stage);
    if (!this.textures.exists(key)) this.textures.addCanvas(key, toCanvas(compose(this.sim.c, look, mood, stage)));
    return key;
  }

  private makeActor(id: string, look: Look, nameColor: string): Actor {
    const key = this.texture(look, 'neutral', 'sober');
    const shadow = this.add.ellipse(0, 0, 30, 8, PAL.shadow, 0.35);
    const ring = this.add.ellipse(0, 0, 38, 12, PAL.select, 0.95).setVisible(false);
    const img = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(2);
    const name = this.text(0, 3, '', { fontSize: '10px', color: nameColor, backgroundColor: 'rgba(0,0,0,0.7)', padding: { x: 3, y: 1 }, fontStyle: 'bold' }).setOrigin(0.5, 0);
    const tag = this.text(0, 17, '', { fontSize: '8px', color: '#ffffffcc', backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 2, y: 0 } }).setOrigin(0.5, 0);
    const bubbleBg = this.add.graphics();
    const icon = this.text(0, -15, '', { fontSize: '14px', fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif' }).setOrigin(0.5, 0.5);
    const bubble = this.add.container(13, -54, [bubbleBg, icon]).setVisible(false);
    const c = this.add.container(0, 0, [shadow, ring, img, name, tag, bubble]).setSize(40, 76);
    c.setInteractive(new Phaser.Geom.Rectangle(-20, -56, 40, 80), Phaser.Geom.Rectangle.Contains);
    c.on('pointerdown', () => this.ctl.tapPerson(id));
    const a: Actor = { c, img, shadow, ring, name, tag, bubble, bubbleBg, icon, bubbleLevel: -1, seed: Math.random() * 10, key, fullName: '', nameWidth: 0, fullTag: '', tagWidth: 0, zone: '' };
    this.actors.set(id, a);
    return a;
  }

  private addNpc(id: string, look: Look, name: string, tag: string, place: Place) {
    const a = this.makeActor(id, look, INK.npc);
    a.name.setText(name); a.tag.setText(tag);
    a.c.removeAllListeners('pointerdown');
    a.c.on('pointerdown', () => this.ctl.tapPlace(place));
  }

  /** A speech bubble with the want's icon. It turns pink and bigger as the want gets urgent. */
  private drawBubble(a: Actor, level: number) {
    if (a.bubbleLevel === level) return;
    a.bubbleLevel = level;
    const urgent = level >= 2, g = a.bubbleBg;
    g.clear();
    g.fillStyle(urgent ? 0xffd6dc : 0xffffff).lineStyle(2, 0x2a1405);
    g.fillRoundedRect(-13, -27, 26, 23, 7).strokeRoundedRect(-13, -27, 26, 23, 7);
    g.fillTriangle(-7, -5, 1, -5, -9, 3).lineBetween(-7, -4, -9, 3).lineBetween(1, -4, -9, 3);
    a.bubble.setScale(level >= 2 ? 1.25 : level >= 1 ? 1.1 : 1);
  }

  /** Cuts a name to fit the space a person has, with an ellipsis. */
  private fitName(a: Actor, full: string, width: number) {
    const w = Math.max(20, Math.floor(width));
    if (a.fullName === full && a.nameWidth === w) return;
    a.fullName = full; a.nameWidth = w;
    a.name.setText(fit(full, w - 6, `bold ${a.zone === 'gone' ? 8 : 10}px`));
  }

  private fitTag(a: Actor, full: string, width: number) {
    const w = Math.max(20, Math.floor(width));
    if (a.fullTag === full && a.tagWidth === w) return;
    a.fullTag = full; a.tagWidth = w;
    a.tag.setText(fit(full, w - 4, '8px'));
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(0.1, deltaMs / 1000);
    this.ctl.tick(deltaMs / 1000);
    const sim = this.sim, s = sim.s;

    // who stands where: NPCs take the first spot of the bar and the door
    const people: Person[] = [...s.friends, ...s.strangers.filter(x => !x.left)];
    for (const [id, a] of this.actors) if (!id.startsWith('npc') && !people.some(p => p.id === id)) { a.c.destroy(); this.actors.delete(id); }
    const byZone: Record<Zone, string[]> = { bar: ['npc-simon'], door: ['npc-anders'], floor: [], table: [], out: [], gone: [] };
    const zoneOf = new Map<string, Zone>();
    for (const p of people) { const z: Zone = !p.stranger && p.gone ? 'gone' : p.zone; byZone[z].push(p.id); zoneOf.set(p.id, z); }

    const t = this.time.now / 1000;
    for (const [zid, ids] of Object.entries(byZone) as [Zone, string[]][]) {
      const z = this.zones[zid];
      ids.forEach((id, i) => {
        const pos = this.slot(z, i, ids.length);
        const p = people.find(q => q.id === id);
        const isNew = !this.actors.has(id);
        const a = this.actors.get(id) ?? this.makeActor(id, p!.look, p!.stranger ? (p!.kind ? INK.trouble : INK.stranger) : INK.friend);
        if (isNew) a.c.setPosition(pos.x, pos.y);
        const k = Math.min(1, dt * 7); // glide towards the spot, so moves read as walking
        a.c.x += (pos.x - a.c.x) * k; a.c.y += (pos.y - a.c.y) * k;
        a.c.setDepth(10 + a.c.y);
        this.syncActor(a, p, z, pos.step, t);
      });
    }

    // the remix: coloured lights sweep the floor while it plays, and glow faintly while Simon teases it
    const rm = s.remix.state, fz = this.zones.floor;
    this.banner.setVisible(rm === 'teasing' || rm === 'playing').setText(rm === 'teasing' ? this.ui('ui.remix.tease') : this.ui('ui.remix.playing'));
    this.spots.forEach((l, i) => {
      const on = rm === 'playing' ? 0.3 : rm === 'teasing' ? 0.1 + 0.05 * Math.sin(t * 3 + i) : 0;
      l.setFillStyle(PAL.remix[i], on);
      l.setPosition(fz.x + fz.w / 2 + Math.sin(t * (0.9 + i * 0.35) + i * 1.7) * fz.w * 0.36, fz.y + fz.h / 2 + Math.cos(t * (0.7 + i * 0.25) + i) * fz.h * 0.25);
    });
    this.bush.setAlpha(s.bushEmpty ? 0.4 : 1);
    this.bushBottle.setVisible(!s.bushEmpty);

    this.floatWords();

    if (s.ended && this.endTimer < 0) this.endTimer = this.time.now + 1400;
    if (this.endTimer > 0 && this.time.now > this.endTimer) { this.endTimer = 0; this.onEnd(); }
  }

  /**
   * Words that float up from people. The same word for several people at once (everyone on the floor
   * for the remix) shows once, over the middle of them, instead of stacking into a blur.
   */
  private floatWords() {
    const groups = new Map<string, { tier: string; xs: number[]; y: number }>();
    for (const f of this.sim.drainFx()) {
      const a = this.actors.get(f.id); if (!a) continue;
      const g = groups.get(f.text) ?? { tier: f.tier, xs: [], y: Infinity };
      g.xs.push(a.c.x); g.y = Math.min(g.y, a.c.y); groups.set(f.text, g);
    }
    const perSpot: Record<string, number> = {};
    [...groups].slice(-5).forEach(([text, g]) => {
      const x = g.xs.reduce((m, v) => m + v, 0) / g.xs.length;
      const spot = `${Math.round(x / 40)}:${Math.round(g.y / 40)}`;
      const n = perSpot[spot] = (perSpot[spot] ?? 0) + 1;
      const big = g.tier === 'nailed' || g.tier === 'chaos' || g.tier === 'magic' || g.xs.length > 1;
      const y = g.xs.length > 1 ? g.y - 18 : g.y - 62 - (n - 1) * 20;
      const w = this.text(x, Math.max(24, y), text, { fontSize: big ? '19px' : '15px', color: FLOAT_COLORS[g.tier] ?? '#fff', stroke: INK.outline, strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5, 1).setDepth(1000);
      w.x = Phaser.Math.Clamp(w.x, w.width / 2 + 4, VIEW_W - w.width / 2 - 4);
      this.tweens.add({ targets: w, y: w.y - 36, alpha: { from: 1, to: 0 }, duration: 1600, ease: 'Cubic.easeOut', onComplete: () => w.destroy() });
    });
  }

  private syncActor(a: Actor, p: Person | undefined, z: ZoneRect, step: number, t: number) {
    const sim = this.sim;
    const gone = z.id === 'gone';
    if (a.zone !== z.id) { // restyle only when someone changes area: text re-renders on every style change
      a.zone = z.id; a.nameWidth = 0; a.tagWidth = 0;
      a.img.setScale(z.scale).setAlpha(gone ? 0.6 : 1);
      a.shadow.setVisible(!gone).setScale(z.scale / 2);
      a.name.setFontSize(gone ? 8 : 10).setY(gone ? 1 : 3);
    }
    const showTag = z.tags && step >= 50;
    a.tag.setVisible(showTag);
    if (!p) { // Simon and Anders
      this.fitName(a, a.fullName || a.name.text, step);
      this.fitTag(a, a.fullTag || a.tag.text, step);
      return;
    }

    let mood: Mood = 'neutral', stage: 'sober' | 'tipsy' | 'wasted' = 'sober';
    if (!p.stranger) {
      const f = p as Friend;
      stage = sim.stage(f);
      mood = f.want?.type === 'backup' || f.want?.type === 'stand' ? 'angry' : f.want?.type === 'hug' || f.want?.type === 'creep' ? 'sad' : f.joy >= 1.5 ? 'happy' : f.joy <= -1.2 ? 'sad' : 'neutral';
    }
    const key = this.texture(p.look, mood, stage);
    if (a.key !== key) { a.key = key; a.img.setTexture(key); }
    this.fitName(a, p.name, step);
    if (showTag) this.fitTag(a, p.stranger ? (p as Stranger).tag : sim.tx.t(`trait.${sim.active(p as Friend)}.short`), step);

    // idle bob, and sway when drunk
    a.img.y = gone ? 0 : Math.round(Math.sin(t * 2 + a.seed)) * 0.5;
    a.img.angle = gone ? 0 : stage === 'tipsy' ? Math.sin(t * 2.4 + a.seed) * 4 : stage === 'wasted' ? Math.sin(t * 4.5 + a.seed) * 9 : 0;
    if (p.stranger) return;

    const f = p as Friend;
    a.ring.setVisible(this.ctl.selected === f.id);
    a.c.setAlpha(!f.gone && sim.s.t < f.busy ? 0.75 : 1);
    if (f.want && !f.gone) {
      this.drawBubble(a, f.want.level);
      a.icon.setText(sim.c.wants[f.want.type].icon);
      a.bubble.setVisible(true);
      a.bubble.x = 13 + (f.want.level >= 2 ? Math.sin(t * 40) * 1.5 : 0);
    } else a.bubble.setVisible(false);
    if (this.ctl.showNumbers) { a.tagWidth = 0; a.tag.setVisible(true).setText(`🍺${f.drunk.toFixed(1)} 🙂${f.joy.toFixed(1)}`); }
  }
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** Width of a name in the nametag font, in logical pixels. */
/** Shortens text with an ellipsis until it fits `width` logical pixels in the given font (for example 'bold 10px'). */
function fit(full: string, width: number, font: string) {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  measureCtx.font = `${font} ${FONT}`;
  let s = full;
  while (s.length > 1 && measureCtx.measureText(s === full ? s : s + '…').width > width) s = s.slice(0, -1);
  return s === full ? s : s + '…';
}

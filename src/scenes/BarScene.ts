import * as Phaser from 'phaser';
import type { Controller } from '../game/controller';
import type { Friend, Person, Place, Stranger } from '../sim/engine';
import type { Zone } from '../content/schema';
import { compose, spriteKey, toCanvas, type Mood } from '../sprites/compose';
import type { Look } from '../content/schema';

/** Logical size. Everything is laid out in this space; the camera zooms it up for sharp text. */
export const VIEW_W = 360, VIEW_H = 640;
const SCALE = 2; // pixel sprites are drawn at 2x inside the logical view

interface ZoneRect { x: number; y: number; w: number; h: number; perRow: number; rows: number[]; place: Place | 'none'; fill: number; label: string }
interface Actor { c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text; bubble: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Ellipse; seed: number; key: string }

const FLOAT_COLORS: Record<string, string> = { nailed: '#FFD83A', fine: '#FFF2D6', backfire: '#9CC7FF', chaos: '#FF5B6E', flip: '#7BF0B6', magic: '#FF9DE0' };

export class BarScene extends Phaser.Scene {
  private ctl!: Controller;
  private onEnd!: () => void;
  private zones = {} as Record<Zone, ZoneRect>;
  private actors = new Map<string, Actor>();
  private floorFlash!: Phaser.GameObjects.Rectangle;
  private banner!: Phaser.GameObjects.Text;
  private bush!: Phaser.GameObjects.Text;
  private endTimer = -1;
  private res = 1;

  constructor() { super('bar'); }

  init(data: { controller: Controller; onEnd: () => void; resolution: number }) {
    this.ctl = data.controller; this.onEnd = data.onEnd; this.res = data.resolution;
  }

  private get sim() { return this.ctl.sim; }
  private ui(key: string, vars?: Record<string, string>) { return this.ctl.ui.t(key, vars); }
  private text(x: number, y: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    return this.add.text(x, y, s, { fontFamily: '"M PLUS Rounded 1c", system-ui, sans-serif', resolution: this.res, ...style });
  }

  create() {
    const cam = this.cameras.main;
    cam.setZoom(this.res).centerOn(VIEW_W / 2, VIEW_H / 2);
    cam.setBackgroundColor('#2A1B3F');

    const G = 4;
    const Z = (x: number, y: number, w: number, h: number, perRow: number, rows: number[], place: Place | 'none', fill: number, label: string): ZoneRect => ({ x, y, w, h, perRow, rows, place, fill, label });
    this.zones = {
      bar: Z(G, G, 176 - G, 166, 3, [84, 152], 'simon', 0x6b3e26, this.ui('ui.zone.bar')),
      door: Z(180 + G / 2, G, 176 - G, 166, 3, [84, 152], 'anders', 0x22303d, this.ui('ui.zone.door')),
      floor: Z(G, 174, VIEW_W - G * 2, 172, 6, [96, 164], 'floor', 0x3a2766, this.ui('ui.zone.floor')),
      table: Z(G, 350, VIEW_W - G * 2, 166, 6, [92, 158], 'table', 0x4b2e2a, this.ui('ui.zone.table')),
      out: Z(G, 520, 176 - G, 116, 4, [96], 'none', 0x24313a, this.ui('ui.zone.out')),
      gone: Z(180 + G / 2, 520, 176 - G, 116, 6, [92], 'none', 0x1c1420, this.ui('ui.zone.gone')),
    };
    for (const z of Object.values(this.zones)) {
      const r = this.add.rectangle(z.x, z.y, z.w, z.h, z.fill).setOrigin(0).setStrokeStyle(2, 0x000000, 0.35);
      if (z === this.zones.floor) this.drawFloor(z);
      this.text(z.x + 7, z.y + 4, z.label, { fontSize: '13px', color: '#FFE9C2' }).setAlpha(0.9);
      r.setInteractive().on('pointerdown', () => this.ctl.tapPlace(z.place));
    }
    const fz = this.zones.floor;
    this.floorFlash = this.add.rectangle(fz.x, fz.y, fz.w, fz.h, 0xff9de0, 0).setOrigin(0);
    this.banner = this.text(VIEW_W / 2, fz.y + 6, '', { fontSize: '13px', color: '#ffffff', backgroundColor: '#FF6F91', padding: { x: 8, y: 2 } }).setOrigin(0.5, 0).setVisible(false).setDepth(50);

    const dz = this.zones.door;
    this.bush = this.text(dz.x + dz.w - 30, dz.y + dz.h - 34, '🌳', { fontSize: '26px' }).setInteractive().on('pointerdown', () => this.ctl.tapPlace('bush'));
    this.bush.setDepth(5);

    // Simon and Anders are fixed characters in the first slot of their zones.
    this.addNpc('npc-simon', { skin: '#F2C29B', hair: '#2B1D14', hairStyle: 'spiky', outfit: '#1F1F28', accessory: 'headphones' }, 'bar', this.ui('ui.npc.simon'), this.ui('ui.npc.simonTag'), 'simon');
    this.addNpc('npc-anders', { skin: '#E8B48E', hair: '#000', hairStyle: 'none', outfit: '#15151C', accessory: 'shades', body: 'broad' }, 'door', this.ui('ui.npc.anders'), this.ui('ui.npc.andersTag'), 'anders');
  }

  private drawFloor(z: ZoneRect) {
    const g = this.add.graphics();
    const s = 18;
    for (let y = z.y; y < z.y + z.h; y += s) for (let x = z.x; x < z.x + z.w; x += s) {
      g.fillStyle(((x - z.x) / s + (y - z.y) / s) % 2 ? 0x45307a : 0x3a2766, 1);
      g.fillRect(x, y, Math.min(s, z.x + z.w - x), Math.min(s, z.y + z.h - y));
    }
  }

  private texture(look: Look, mood: Mood, stage: 'sober' | 'tipsy' | 'wasted') {
    const key = spriteKey(look, mood, stage);
    if (!this.textures.exists(key)) this.textures.addCanvas(key, toCanvas(compose(this.sim.c, look, mood, stage)));
    return key;
  }

  private makeActor(id: string, look: Look, nameColor: string): Actor {
    const key = this.texture(look, 'neutral', 'sober');
    const img = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(SCALE);
    const ring = this.add.ellipse(0, 1, 34, 10, 0xffc94a, 0.9).setVisible(false);
    const name = this.text(0, 3, '', { fontSize: '10px', color: nameColor, backgroundColor: 'rgba(0,0,0,0.68)', padding: { x: 3, y: 1 }, fontStyle: 'bold' }).setOrigin(0.5, 0);
    const tag = this.text(0, 17, '', { fontSize: '8px', color: '#ffffffcc', backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 2, y: 0 } }).setOrigin(0.5, 0);
    const bubble = this.text(14, -58, '', { fontSize: '15px', backgroundColor: '#ffffff', padding: { x: 3, y: 2 } }).setOrigin(0.5, 1).setVisible(false);
    const c = this.add.container(0, 0, [ring, img, name, tag, bubble]).setSize(40, 76);
    c.setInteractive(new Phaser.Geom.Rectangle(-20, -56, 40, 80), Phaser.Geom.Rectangle.Contains);
    c.on('pointerdown', () => this.ctl.tapPerson(id));
    const a: Actor = { c, img, name, tag, bubble, ring, seed: Math.random() * 10, key };
    this.actors.set(id, a);
    return a;
  }

  private addNpc(id: string, look: Look, zone: Zone, name: string, tag: string, place: Place) {
    const a = this.makeActor(id, look, '#FFE45C');
    a.name.setText(name); a.tag.setText(tag);
    const z = this.zones[zone];
    a.c.setPosition(z.x + 28, z.y + z.rows[0]);
    a.c.removeAllListeners('pointerdown');
    a.c.on('pointerdown', () => this.ctl.tapPlace(place));
  }

  private slotPos(zone: Zone, i: number) {
    const z = this.zones[zone];
    const small = zone === 'gone';
    const step = small ? 28 : (z.w - 16) / z.perRow;
    const col = i % z.perRow, row = Math.min(z.rows.length - 1, Math.floor(i / z.perRow));
    return { x: z.x + 8 + step * (col + 0.5), y: z.y + z.rows[row] };
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(0.1, deltaMs / 1000);
    const sim = this.sim, s = sim.s;
    if (!this.ctl.paused) sim.step(dt * this.ctl.speed);

    // layout: count people per zone, NPCs take the first slot of bar and door
    const counters: Record<Zone, number> = { bar: 1, door: 1, floor: 0, table: 0, out: 0, gone: 0 };
    const people: Person[] = [...s.friends, ...s.strangers.filter(x => !x.left)];
    for (const [id, a] of this.actors) if (!id.startsWith('npc') && !people.some(p => p.id === id)) { a.c.destroy(); this.actors.delete(id); }
    const t = this.time.now / 1000;
    for (const p of people) {
      const isNew = !this.actors.has(p.id);
      const a = this.actors.get(p.id) ?? this.makeActor(p.id, p.look, p.stranger ? (p.kind ? '#FF9E9E' : '#A9DBFF') : '#ffffff');
      const zone: Zone = p.stranger ? p.zone : p.gone ? 'gone' : p.zone;
      const pos = this.slotPos(zone, counters[zone]++);
      if (isNew) a.c.setPosition(pos.x, pos.y);
      const k = Math.min(1, dt * 7); // glide towards the slot, so moves read as walking
      a.c.x += (pos.x - a.c.x) * k; a.c.y += (pos.y - a.c.y) * k;
      this.syncActor(a, p, zone, t);
    }

    // remix
    const rm = s.remix.state;
    this.banner.setVisible(rm === 'teasing' || rm === 'playing').setText(rm === 'teasing' ? this.ui('ui.remix.tease') : this.ui('ui.remix.playing'));
    this.floorFlash.setFillStyle(0xff9de0, rm === 'playing' ? (Math.sin(t * 12) > 0 ? 0.22 : 0.05) : 0);
    this.bush.setAlpha(s.bushEmpty ? 0.35 : 1);

    // floating words
    const perActor: Record<string, number> = {};
    for (const f of sim.drainFx().slice(-5)) {
      const a = this.actors.get(f.id); if (!a) continue;
      const n = perActor[f.id] = (perActor[f.id] ?? 0) + 1; if (n > 2) continue;
      const w = this.text(a.c.x, a.c.y - 64 - (n - 1) * 20, f.text, { fontSize: f.tier === 'nailed' || f.tier === 'chaos' || f.tier === 'magic' ? '19px' : '15px', color: FLOAT_COLORS[f.tier] ?? '#fff', stroke: '#2A1405', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5, 1).setDepth(100);
      w.x = Phaser.Math.Clamp(w.x, w.width / 2 + 4, VIEW_W - w.width / 2 - 4);
      this.tweens.add({ targets: w, y: w.y - 40, alpha: { from: 1, to: 0 }, duration: 1500, ease: 'Cubic.easeOut', onComplete: () => w.destroy() });
    }

    if (s.ended && this.endTimer < 0) this.endTimer = this.time.now + 1400;
    if (this.endTimer > 0 && this.time.now > this.endTimer) { this.endTimer = 0; this.onEnd(); }
  }

  private syncActor(a: Actor, p: Person, zone: Zone, t: number) {
    const sim = this.sim;
    let mood: Mood = 'neutral', stage: 'sober' | 'tipsy' | 'wasted' = 'sober';
    if (!p.stranger) {
      const f = p as Friend;
      stage = sim.stage(f);
      mood = f.want?.type === 'backup' || f.want?.type === 'stand' ? 'angry' : f.want?.type === 'hug' || f.want?.type === 'creep' ? 'sad' : f.joy >= 1.5 ? 'happy' : f.joy <= -1.2 ? 'sad' : 'neutral';
    }
    const key = this.texture(p.look, mood, stage);
    if (a.key !== key) { a.key = key; a.img.setTexture(key); }
    const gone = zone === 'gone';
    a.img.setScale(gone ? 1.4 : SCALE).setAlpha(gone ? 0.55 : 1);
    a.name.setText(p.name.length > 11 ? p.name.slice(0, 10) + '…' : p.name).setY(gone ? 2 : 3);
    a.tag.setText(p.stranger ? (p as Stranger).tag : sim.tx.t(`trait.${sim.active(p as Friend)}.short`)).setVisible(!gone);
    // idle bob, and sway when drunk
    const bob = Math.round(Math.sin(t * 2 + a.seed)) * 0.5;
    a.img.y = gone ? 0 : bob;
    a.img.angle = gone ? 0 : stage === 'tipsy' ? Math.sin(t * 2.4 + a.seed) * 4 : stage === 'wasted' ? Math.sin(t * 4.5 + a.seed) * 9 : 0;
    if (p.stranger) return;
    const f = p as Friend;
    a.ring.setVisible(this.ctl.selected === f.id);
    a.c.setAlpha(!f.gone && sim.s.t < f.busy ? 0.75 : 1);
    if (f.want && !f.gone) {
      const lvl = f.want.level;
      a.bubble.setVisible(true).setText(sim.c.wants[f.want.type].icon).setScale(lvl >= 2 ? 1.35 : lvl >= 1 ? 1.15 : 1);
      a.bubble.x = 14 + (lvl >= 2 ? Math.sin(t * 40) * 1.5 : 0);
      a.bubble.setBackgroundColor(lvl >= 2 ? '#FFD6DC' : '#ffffff');
    } else a.bubble.setVisible(false);
    if (this.ctl.showNumbers) a.tag.setText(`🍺${f.drunk.toFixed(1)} 🙂${f.joy.toFixed(1)}`);
  }
}

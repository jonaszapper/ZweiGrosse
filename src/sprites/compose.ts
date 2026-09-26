import type { Content } from '../content/load';
import { SPRITE_H, SPRITE_W } from '../content/load';
import type { Look } from '../content/schema';

export type Mood = 'neutral' | 'happy' | 'sad' | 'angry';
export type SpriteStage = 'sober' | 'tipsy' | 'wasted';
export interface Pixels { w: number; h: number; data: Uint8ClampedArray }

const PAD = 1; // room for the outline
const SHADED = new Set(['s', 'h', 'o', 'p', 'a']);
/** Small features drawn on top of an area. They don't count as the edge of that area when shading. */
const FEATURES = new Set(['e', 'm', 'b']);

function hex(c: string): [number, number, number] {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Builds one character sprite from layered text-grid parts.
 * Order: body, face, blush, hair, accessory. Then shading and a one-pixel outline are added.
 * Pure function: works in the browser and in Node tests.
 */
export function compose(c: Content, look: Look, mood: Mood = 'neutral', stage: SpriteStage = 'sober', opts = { outline: true, shade: true }): Pixels {
  const P = c.palette;
  const layers = [
    c.parts.body?.[look.body ?? 'normal'],
    c.parts.face?.[stage === 'wasted' ? 'wasted' : mood],
    stage !== 'sober' ? c.parts.face?.blush : undefined,
    look.hairStyle !== 'none' ? c.parts.hair?.[look.hairStyle] : undefined,
    look.accessory ? c.parts.accessory?.[look.accessory] : undefined,
  ];
  const W = SPRITE_W + PAD * 2, H = SPRITE_H + PAD * 2;
  const letter: string[] = new Array(W * H).fill('.');
  const color: (string | null)[] = new Array(W * H).fill(null);
  const own: Record<string, string> = { s: look.skin, h: look.hair, o: look.outfit };
  for (const part of layers) {
    if (!part) continue;
    part.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const col = part.colors?.[ch] ?? own[ch] ?? P.fixed[ch];
      if (!col) return;
      const i = (y + PAD) * W + (x + PAD);
      letter[i] = ch; color[i] = col;
    }));
  }
  const data = new Uint8ClampedArray(W * H * 4);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? '.' : letter[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, ch = letter[i];
    let rgb: [number, number, number] | null = null;
    if (ch !== '.') {
      rgb = hex(color[i]!);
      // shade the lower and right edges of each colour area
      const below = at(x, y + 1);
      if (opts.shade && SHADED.has(ch) && ((below !== ch && !FEATURES.has(below)) || at(x + 1, y) === '.')) rgb = rgb.map(v => Math.round(v * P.shade)) as [number, number, number];
    } else if (opts.outline && (at(x - 1, y) !== '.' || at(x + 1, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '.')) {
      rgb = hex(P.outline);
    }
    if (rgb) { data.set([rgb[0], rgb[1], rgb[2], 255], i * 4); }
  }
  return { w: W, h: H, data };
}

/** Draws a composed sprite onto a new canvas (browser only). */
export function toCanvas(px: Pixels): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = px.w; cv.height = px.h;
  const ctx = cv.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.w, px.h), 0, 0);
  return cv;
}

export const spriteKey = (look: Look, mood: Mood, stage: SpriteStage) =>
  ['spr', look.body ?? 'normal', look.skin, look.hair, look.hairStyle, look.outfit, look.accessory ?? '', mood, stage].join('|');

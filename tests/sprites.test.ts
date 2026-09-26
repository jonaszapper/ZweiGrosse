import { describe, expect, it } from 'vitest';
import { loadNodeContent } from '../tools/node-content';
import { compose } from '../src/sprites/compose';

const c = loadNodeContent();

describe('sprites', () => {
  it('composes every hair style, accessory and mood', () => {
    const base = { skin: c.palette.skins[0], hair: c.palette.hairs[0], outfit: c.palette.outfits[0] };
    for (const hairStyle of [...Object.keys(c.parts.hair), 'none'])
      for (const accessory of [undefined, ...Object.keys(c.parts.accessory)])
        for (const mood of ['neutral', 'happy', 'sad', 'angry'] as const) {
          const px = compose(c, { ...base, hairStyle, accessory }, mood, 'tipsy');
          expect(px.w * px.h * 4).toBe(px.data.length);
          expect(px.data.some(v => v > 0)).toBe(true);
        }
  });
});

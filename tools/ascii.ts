// Prints a few composed sprites as coloured blocks in the terminal: `npx tsx tools/ascii.ts`
import { loadNodeContent } from './node-content';
import { compose } from '../src/sprites/compose';
const c = loadNodeContent();
const looks = [
  { skin: '#F2C29B', hair: '#C2452D', hairStyle: 'bowl', outfit: '#3E9BE0' },
  { skin: '#A8704B', hair: '#1F1F1F', hairStyle: 'long', outfit: '#FF6F91' },
  { skin: '#F4CDB0', hair: '#B9B4AE', hairStyle: 'none', outfit: '#7A6A58', accessory: 'combover' },
  { skin: '#E8B48E', hair: '#000', hairStyle: 'none', outfit: '#15151C', accessory: 'shades', body: 'broad' },
];
const moods = ['happy', 'neutral', 'sad', 'angry'] as const;
const sprites = looks.map((l, i) => compose(c, l, moods[i], i === 1 ? 'tipsy' : 'sober'));
for (let y = 0; y < sprites[0].h; y++) {
  let line = '';
  for (const s of sprites) {
    for (let x = 0; x < s.w; x++) {
      const i = (y * s.w + x) * 4;
      line += s.data[i + 3] ? `\x1b[48;2;${s.data[i]};${s.data[i + 1]};${s.data[i + 2]}m  \x1b[0m` : '  ';
    }
    line += '  ';
  }
  console.log(line);
}

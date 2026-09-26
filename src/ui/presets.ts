import type { CrewMember } from '../sim/engine';
import type { Look } from '../content/schema';

export const NAMES = ['Mads', 'Emil', 'Freja', 'Ida', 'Oskar', 'Sofie', 'Magnus', 'Laura', 'Anton', 'Clara', 'Viktor', 'Asta', 'Noah', 'Maja', 'Karl', 'Liva', 'Ali', 'Sara', 'Mikkel', 'Amalie'];

type T = [string, string, string];
const P: Record<string, T[]> = {
  usual: [['Mads', 'hothead', 'hothead'], ['Emil', 'wallflower', 'party'], ['Freja', 'mum', 'softie'], ['Ida', 'charmer', 'drama'], ['Oskar', 'lightweight', 'loyal']],
  hotheads: [['Mads', 'hothead', 'hothead'], ['Magnus', 'hothead', 'hothead'], ['Viktor', 'hothead', 'hothead'], ['Karl', 'hothead', 'hothead'], ['Anton', 'hothead', 'hothead']],
  mums: [['Freja', 'mum', 'softie'], ['Laura', 'mum', 'party'], ['Clara', 'mum', 'drama'], ['Asta', 'mum', 'mum'], ['Oskar', 'lightweight', 'lightweight']],
  walls: [['Emil', 'wallflower', 'wallflower'], ['Liva', 'wallflower', 'softie'], ['Noah', 'wallflower', 'party'], ['Ida', 'charmer', 'charmer'], ['Maja', 'party', 'party']],
  chaos: [['Ali', 'hothead', 'party'], ['Mikkel', 'lightweight', 'hothead'], ['Sara', 'drama', 'jealous'], ['Magnus', 'spender', 'spender'], ['Amalie', 'party', 'drama']],
};
export const PRESET_IDS = ['usual', 'random', 'hotheads', 'mums', 'walls', 'chaos'] as const;

export function preset(id: string, traits: string[], look: () => Look): CrewMember[] {
  if (id === 'random') {
    const names = [...NAMES].sort(() => Math.random() - 0.5);
    const r = () => traits[Math.floor(Math.random() * traits.length)];
    return names.slice(0, 5).map(name => ({ name, traits: [r(), r()], look: look() }));
  }
  return (P[id] ?? P.usual).map(([name, a, b]) => ({ name, traits: [a, b], look: look() }));
}

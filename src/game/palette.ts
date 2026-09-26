/**
 * The bar's colours, in one place. The HTML screens use the same values as CSS variables in `src/ui/style.css`.
 * Rule of thumb: the room is dark and cool, light is warm (lamps, taps, the door), people and UI panels pop on top.
 */
export const PAL = {
  night: 0x1a1128,     // behind everything, and the page around the night
  room: 0x2a1b3f,      // the bar's walls
  edge: 0x0e0814,      // outlines between areas
  woodDark: 0x4a2a1c,
  wood: 0x6b3e26,
  woodLight: 0x9a5a34,
  brass: 0xffc94a,
  lamp: 0xffd98a,
  floorA: 0x3a2766,
  floorB: 0x45307a,
  door: 0x22303d,
  doorLight: 0xffb35c,
  street: 0x24313a,
  brick: 0x3a2a2e,
  gone: 0x17111f,
  leaf: 0x3f8f4a,
  leafDark: 0x2a6636,
  select: 0xffc94a,
  shadow: 0x000000,
  remix: [0xff6f91, 0x7bf0b6, 0x8ccbf5, 0xffc94a],
} as const;

/** CSS colours for text in the scene. */
export const INK = {
  label: '#FFE9C2',
  friend: '#FFFFFF',
  npc: '#FFE45C',
  stranger: '#A9DBFF',
  trouble: '#FF9E9E',
  outline: '#2A1405',
  bubble: '#FFFFFF',
  bubbleUrgent: '#FFD6DC',
};

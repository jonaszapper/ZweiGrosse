/** Seeded random numbers. All randomness in the sim goes through this, so a seed reproduces a night exactly. */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rng: Rng, a: readonly T[]): T => a[Math.floor(rng() * a.length)];
export const chance = (rng: Rng, p: number) => rng() < p;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

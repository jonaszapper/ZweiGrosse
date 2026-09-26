import type { Rng } from './rng';

export type TextTable = Record<string, string | string[]>;
export type Vars = Record<string, string | number | undefined>;

/**
 * Looks up player-facing text by key. A key can hold one string or a list of variants.
 * Placeholders like {h}, {t}, {s} are filled from vars.
 * In strict mode (tests, check-content) a missing key throws, so typos never reach players.
 */
export class Text {
  missing = new Set<string>();
  constructor(private table: TextTable, private rng: Rng, public strict = false) {}

  has(key: string) { return key in this.table; }

  t(key: string, vars: Vars = {}): string {
    const entry = this.table[key];
    if (entry === undefined) {
      this.missing.add(key);
      if (this.strict) throw new Error(`Missing text key: ${key}`);
      return `[${key}]`;
    }
    const s = Array.isArray(entry) ? entry[Math.floor(this.rng() * entry.length)] : entry;
    return fill(s, vars);
  }

  /** Every variant for a key, filled in. */
  all(key: string, vars: Vars = {}): string[] {
    const e = this.table[key];
    if (e === undefined) return [`[${key}]`];
    return (Array.isArray(e) ? e : [e]).map(s => fill(s, vars));
  }
}

export function fill(s: string, vars: Vars) {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}

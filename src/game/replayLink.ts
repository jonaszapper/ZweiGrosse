import { z } from 'zod';
import { LookSchema } from '../content/schema';
import type { Replay } from '../sim/replay';

/** Replays travel as `?replay=<code>`: the replay as JSON, in URL-safe base64. */

const ReplaySchema = z.object({
  v: z.literal(1),
  seed: z.number(),
  dt: z.number().positive(),
  crew: z.array(z.object({ name: z.string(), traits: z.tuple([z.string(), z.string()]), look: LookSchema.extend({ accessory: z.string().optional(), body: z.string().optional() }) })).min(1),
  carry: z.object({ night: z.number(), bonds: z.record(z.string(), z.number()) }).optional(),
  inputs: z.array(z.array(z.union([z.number(), z.string()]))),
});

export function encodeReplay(r: Replay) {
  const bytes = new TextEncoder().encode(JSON.stringify(r));
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeReplay(code: string): Replay | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
    const r = ReplaySchema.safeParse(JSON.parse(json));
    return r.success ? (r.data as Replay) : null;
  } catch { return null; }
}

/** A link that replays the night exactly, for bug reports. */
export function replayUrl(r: Replay) {
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('replay', encodeReplay(r));
  return u.toString();
}

/** Copies the replay link. Falls back to a prompt where the clipboard is blocked (plain http on a phone). */
export async function copyReplayLink(r: Replay, promptText: string) {
  const url = replayUrl(r);
  try { await navigator.clipboard.writeText(url); return true; } catch { window.prompt(promptText, url); return false; }
}

import type { Carry, CrewMember, Place, Sim } from './engine';

/**
 * Exact replays. A night is decided by four things: the seed, the crew, what carried over from
 * the night before, and the player's taps. The sim records the taps by step number, and the game
 * always steps in fixed ticks, so frame rate and speed never change what happens.
 */

/** Seconds of game time per sim step in the game. Speed changes how many steps run per frame, never their size. */
export const TICK = 0.05;

/** A player action at a step: send a friend to a friend or stranger, send a friend to a place, or end the night. */
export type Input = [step: number, helper: string, target: string] | [step: number, place: '@', helper: string, place: Place] | [step: number, end: 'end'];

export interface Replay { v: 1; seed: number; dt: number; crew: CrewMember[]; carry?: Carry; inputs: Input[] }

/** Advances a night in fixed steps, and plays back recorded inputs when given a replay. */
export class Clock {
  private acc = 0;
  private next = 0;

  constructor(readonly sim: Sim, readonly dt = TICK, private queue: Input[] = []) {}

  /** True while recorded inputs are still waiting to be played. */
  get replaying() { return this.next < this.queue.length; }

  /** Moves the night forward by `seconds` of game time. */
  advance(seconds: number) {
    // Never try to catch up more than a second at once (a background tab, a slow phone).
    this.acc = Math.min(this.acc + seconds, 1);
    this.play();
    while (this.acc >= this.dt && !this.sim.s.ended) {
      this.sim.step(this.dt);
      this.acc -= this.dt;
      this.play();
    }
  }

  private play() {
    const s = this.sim.s;
    while (this.next < this.queue.length && this.queue[this.next][0] <= s.steps) apply(this.sim, this.queue[this.next++]);
  }
}

function apply(sim: Sim, i: Input) {
  if (i[1] === 'end') sim.endNow();
  else if (i[1] === '@') sim.sendPlace(i[2], i[3] as Place);
  else sim.sendTo(i[1], i[2] as string);
}

/** Plays a whole recorded night from the start, without a screen. Used by tests and tools. */
export function replayNight(sim: Sim, r: Replay) {
  sim.newNight(r.crew, r.carry);
  const clock = new Clock(sim, r.dt, r.inputs);
  let guard = 0;
  while (!sim.s.ended && guard++ < 1e6) clock.advance(r.dt);
  return sim;
}

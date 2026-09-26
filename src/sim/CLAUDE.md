# The simulation

`engine.ts` holds the rules for one night. `bot.ts` is an autopilot used by tests and the balance runner.

- Pure and deterministic. No DOM, no Phaser, no `Math.random`, no `Date`. Same seed, crew, carry-over and inputs give the same night. There are tests for this.
- `replay.ts` holds the fixed-tick `Clock` the game uses and `replayNight`. `sendTo`, `sendPlace` and `endNow` record themselves in `s.inputs` by step number. `randomLook()` for the crew uses its own random numbers, so rolling looks never changes the night.
- "Sent home badly" is `wentBadly(f)`: gone for any reason not in `FINE_EXITS`. The recap, tests and balance runner all use it.
- Text goes through `this.t(key, vars)`. Chat lines in stories take keys too (`[from, key, vars]`). Outcome text uses `out.<want>.<result>` keys.
- Hand-written pair moments live in `signature()`. Their text is under `combo.<name>` in `content/text/da/combos.yaml`. To add one: add a branch in `signature()`, add the text, run `npm test`.
- Wants are fixed in `src/content/schema.ts` (`WANT_IDS`) because each has logic here. Traits are data: a new trait file in `content/traits/` works without code, it just has no special quirks.

## Before and after changing balance
Run `npm run sim -- --nights 500` before and after, and paste both tables in the PR. The main numbers:
- friends sent home badly per night for an attentive player: aim for roughly 1.3 to 2 of 5
- nights where nobody is sent home badly: roughly 30 to 45%
- nights with the whole crew on the floor for the remix

`tests/sim.test.ts` has a wide safety band. If it fails, decide whether the new number is intended before widening it.

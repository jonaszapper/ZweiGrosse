# The simulation

`engine.ts` holds the rules for one night. `bot.ts` is an autopilot used by tests and the balance runner.

- Pure and deterministic. No DOM, no Phaser, no `Math.random`, no `Date`. Same seed and same inputs give the same night. There is a test for this.
- Text goes through `this.t(key, vars)`. Chat lines in stories take keys too (`[from, key, vars]`). Outcome text uses `out.<want>.<result>` keys.
- Hand-written pair moments live in `signature()`. Their text is under `combo.<name>` in `content/text/da/combos.yaml`. To add one: add a branch in `signature()`, add the text, run `npm test`.
- Wants are fixed in `src/content/schema.ts` (`WANT_IDS`) because each has logic here. Traits are data: a new trait file in `content/traits/` works without code, it just has no special quirks.

## Before and after changing balance
Run `npm run sim -- --nights 500` before and after, and paste both tables in the PR. The main numbers:
- friends sent home badly per night for an attentive player: aim for roughly 1.3 to 2 of 5
- nights where nobody is sent home badly: roughly 30 to 45%
- nights with the whole crew on the floor for the remix

`tests/sim.test.ts` has a wide safety band. If it fails, decide whether the new number is intended before widening it.

# Zwei Grosse Bier Bar

A mobile web game about a night out at our hometown bar. The player steers a crew of friends by tapping one friend and then another friend (or a place) to send help. Friends have wants, get drunk, flip traits, and can go home badly. The morning after is told as a group chat.

Read `docs/DESIGN.md` before proposing features or changing how the game feels: it holds the design decisions, what we ruled out, the tone, balance targets and the prioritized to-do list.

## Stack
- TypeScript, Vite 8, **Phaser 4** for the bar scene, Preact for HTML screens, zod 4 for content validation, Vitest for tests.
- **Phaser 4, not Phaser 3.** Most examples online are v3 and many APIs changed. Before writing Phaser code, read the skills that ship with Phaser in `node_modules/phaser/skills/` (start with `v3-to-v4-migration/SKILL.md` and the topic you need, for example `tweens/`, `input-keyboard-mouse-touch/`, `text-and-bitmaptext/`).

## Commands
- `npm run dev`: local dev server with hot reload. The sprite lab is at `/tools/sprite-lab/`.
- `npm run ci`: typecheck, content check, tests and build. Run this before every PR; CI runs the same.
- `npm run sim -- --nights 500`: plays nights with an autopilot and prints balance numbers.
- `npm run check:content`: validates every YAML file and lists problems with file names.

## Layout
- `src/sim/` The game rules. Pure TypeScript. See `src/sim/CLAUDE.md`.
- `src/scenes/BarScene.ts` The Phaser scene: lays out the areas, draws the scenery, moves sprites, turns taps into controller calls.
- `src/game/palette.ts` The bar's colours.
- `src/game/controller.ts` Selection, hints, speed. Shared by the scene and the HUD.
- `src/ui/` Preact screens: crew builder, night HUD, morning-after chat.
- `src/sprites/compose.ts` Builds pixel sprites from the text-grid parts in `art/`.
- `src/content/` Loads and validates `content/` and `art/`.
- `content/` Game data and all player-facing text. See `content/CLAUDE.md`.
- `art/` Palette and pixel parts as text grids. See `art/CLAUDE.md`.
- `tools/` Balance runner, content checker, sprite lab, terminal sprite preview.

## Rules
1. **The sim never touches the DOM or Phaser.** Everything in `src/sim` must run in Node. The scene reads sim state and calls `sendTo` / `sendPlace`; it never changes state directly.
2. **No player-facing text in code.** Every string shown to players is a key in `content/text/da/*.yaml`, looked up with `t('key', vars)`. New keys go in the YAML in the same PR. Tests run the sim in strict mode, so a missing key fails CI.
3. **All randomness in the sim goes through the seeded RNG** (`this.rng`, `this.pick`, `this.chance`). Never `Math.random()` in `src/sim`. The seed, the crew, the carry-over from last night and the player's taps decide a night exactly. The game steps the sim in fixed ticks (`src/sim/replay.ts`), so speed and frame rate never change what happens. Player actions reach the sim only through `sendTo`, `sendPlace` and `endNow`, which record themselves; don't add another way in without recording it. Tapping the seed in the night footer copies a `?replay=` link that plays the night again exactly.
4. **Numbers live in `content/tuning.yaml`**, not in code, when a designer might want to tweak them.
5. **Mobile first.** The scene is 360 logical pixels wide and 480 to 640 tall, whatever fills the phone (`viewHeight` in `BarScene.ts`); lay things out relative to the areas, never at fixed y positions. The night must fit the screen without scrolling: test at 360×640 and 390×844. Tap targets at least 40 logical pixels. Colours come from `src/game/palette.ts`.
6. Keep PRs small and focused on one thing. Say in the PR what you changed and how you checked it.

## Debugging
During a night, `zg` in the browser console is the controller. `zg.sim.s` is the whole state, `zg.speed = 8` speeds up, `zg.endNight()` skips to 03:00, `zg.sim.replay()` is the recording of the night so far.

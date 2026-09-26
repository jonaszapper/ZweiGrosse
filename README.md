# Zwei Grosse Bier Bar

A little mobile game about a night out at the bar back home. Build your crew, keep them out of trouble (or don't), get everyone on the dancefloor when Simon drops the remix, and read about it in the group chat the morning after.

## Play it locally
You need [Node.js](https://nodejs.org) 22 or newer.

```
npm install
npm run dev
```

Open the address it prints. On your phone, run `npm run dev -- --host` and open the network address while on the same wifi.

## Who does what
You don't need to code to help. Everything a writer, artist or designer touches is plain text in this repo.

| You want to... | Go to | Guide |
|---|---|---|
| Write or fix lines, add variants, change names | `content/text/da/` | `content/CLAUDE.md` |
| Change how traits, wants and strangers behave | `content/traits/`, `content/strangers/`, `content/tuning.yaml` | `content/CLAUDE.md` |
| Draw characters, hair, accessories | `art/` (then open the sprite lab) | `art/CLAUDE.md` |
| Make the remix and sound effects | `audio/` | `audio/README.md` |
| Change the game rules | `src/sim/` | `src/sim/CLAUDE.md` |
| Change how the bar looks and feels | `src/scenes/`, `src/ui/` | `CLAUDE.md` |

The `CLAUDE.md` files are written for both people and Claude Code. If you use Claude Code, it reads them automatically.

### Editing text without installing anything
1. Open the file on GitHub, for example `content/text/da/chat.yaml`, and click the pencil.
2. Change or add lines. Keep the double quotes and the `{placeholders}`.
3. Choose "Create a new branch and start a pull request".
4. CI checks your change. If something is wrong it tells you the file and the line. A preview link to play your version appears on the pull request once deploys are set up (below).

## Checks
- `npm run ci` runs everything CI runs: typecheck, content check, tests, build.
- `npm run sim -- --nights 500` plays 500 nights with an autopilot and prints balance numbers. CI runs 300 nights and shows the table in the run summary.
- Every night shows a seed at the bottom. Tap it to copy a replay link: it plays that exact night again, with the same crew and the same taps. Paste it in bug reports: "Mads got thrown out at 22:10 for no reason" plus the link. There is a replay link on the morning-after screen too. (`?seed=<number>` only fixes how a night starts. With a different crew or other taps it plays out differently.)

## Setting up
1. **GitHub:** create an empty repo, then in this folder run `git init`, `git add .`, `git commit -m "Starter"`, add the remote and push. Protect `main` so changes go through pull requests and require the CI check to pass.
2. **Preview links (Cloudflare):** in the Cloudflare dashboard, create a new application from your GitHub repo. Build command `npm run build`, output directory `dist`. Every pull request then gets its own link to play, and `main` is the live version. Cloudflare's wizard may steer you towards Workers rather than Pages; both work for a static site like this.
3. **License:** not chosen yet. Decide together before making the repo public. Note that the art style references MapleStory only as inspiration; all sprites here are our own.

## What's here
- The full night from the sandbox, ported to TypeScript and driven by the YAML content: 12 traits with sober and drunk sides, 12 wants, 12 strangers including five kinds of troublemakers, signature pair moments, the remix, the morning-after chat, and bonds that carry over to the next night.
- A Phaser 4 bar scene with generated pixel sprites that walk between zones, sway when drunk and change faces with their mood.
- A sprite lab at `/tools/sprite-lab/`.
- Tests that play 300 nights in strict mode, so a typo in a text key or a crash in a rare branch fails CI.

## Next up
The design notes and the prioritized to-do list are in `docs/DESIGN.md`. Starting a Claude Code session in this repo for the first time? Use the prompt in `docs/FIRST_PROMPT.md`.

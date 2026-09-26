# Design notes

Why the game is the way it is. Read this before proposing new features or changing how the game feels. The rules for code are in `CLAUDE.md`; this file holds the reasons behind them.

## What it is
A small mobile web game about a night out at Zwei Grosse Bier Bar, the bar in our hometown. It is made by a group of five or six friends, coders and non-coders, based on nights we have actually had. The first audience is us. If it makes us say "that's so us", it works.

The original playable sandbox, which shows how it should feel: https://claude.ai/artifact/N4PMgTQFJ2YnTqyGRzSCQt

## The real places and people
- **Zwei Grosse Bier Bar**: the only bar in town.
- **Anders**: the bouncer. Short and very broad. Turns away people who are too drunk, gets stricter after trouble, won't touch the gang guy. You can talk to him or report troublemakers to him.
- **Simon**: bartender and DJ, went to school with us. Gives free beer to people he likes. Plays electronic remixes of things like High School Musical. The remix is the peak of the night.
- **The warm**: the pregame at someone's place, vodka-soda, Smirnoff Ice, Safari with Fanta.
- **The bush**: where we stash bottles outside so we don't pay bar prices. Going out to it means getting past Anders again.
- Friends disappearing to the smoking area, people leaving early drunk, getting sent home.

Simon and Anders are real people. Ask them before adding anything about them that they might not like.

## Core design
- **The Table.** The game is a plaything, not an optimisation puzzle. There is one verb: tap a friend, then tap the friend (or place) they should go to.
- **Friends are autonomous.** They want things, shown as icons that grow more urgent. If nobody helps in time, something happens without you.
- **Attention is the scarce resource.** You can't help everyone. The interesting decision is who gets help and from whom.
- **No visible numbers by default.** Drunkenness and mood are shown through faces, swaying and what people do. "Vis tallene" exists for us while developing.
- **Nights can end badly.** Fights, getting thrown out, arrests, hospital, being sick, heartbreak, parents called. These are stories, not game over. The morning after makes them funny.
- **The remix moment.** Simon teases the remix; getting the whole crew on the dancefloor when it drops is the best thing that can happen in a night.
- **The morning-after group chat** tells the night's best stories in the crew's own voices. The game curates: it picks the heaviest moments, not a full log.

## Traits
Each friend has two traits: a sober one and a drunk one. The drunk one takes over at drunk level 4 ("stiv"). At 8 they are "i hegnet". The flip is part of the fun: the careful friend becomes a party animal after a few.

- 12 traits, each with four skills: charm, care, heat, wild. Wants have a skill that handles them; some wants have two, and the helper's stronger skill decides how they handle it (push or calm).
- A roll is skill + bond + click/clash + a d6 against 4 (plus urgency). Results: nailed, fine, backfire, chaos.
- Same-trait pairs have their own rules: two hotheads start two fights, two mums means one has the night off, two softies cry together in the toilet, two lightweights drink in step and go home together.
- About 17 hand-written pair moments (signature combos), for example the charmer who goes to wingman the wallflower and the stranger picks the wallflower instead.
- Duplicates are allowed. "Fire mødre" is a preset for a reason.
- Inspired by RimWorld, Crusader Kings (few traits, strong personality), Tomodachi Life, and apophenia: players read stories into simple systems, so traits should be few and legible.

## Troublemakers
Two or three per night, picked at the start: Klamme Kaj (an old creep), the hooligan, the racist farm boys, Tømrer-Tommy (cash, rounds, a jacuzzi afterparty), and the gang guy. They create new wants: creep, stand, afterparty. Each has outcomes that can end someone's night.

## Tone
- Honest, not wholesome. It should feel like real nights out in a Danish provincial town at 18 to 20.
- Written in Danish, the way people our age talk and text. Group chat is lowercase, short, slangy. Log lines are dry and a bit funny.
- Content boundaries are in `content/CLAUDE.md`: no slurs, harassment shown through reactions, drugs with consequences but no instructions.

## Look
- Chibi pixel characters, big heads, MapleStory as inspiration for the feel only. Nothing copied.
- Sprites are generated from text-grid parts so we can make and change them with code and Claude. The sprite lab is where art gets reviewed.
- Warm, cosy UI panels around a dark bar.

### The bar screen (style frame)
- **One screen, no scrolling.** Clock and speed on top, the bar in the middle, one panel below with the hint and the two latest log lines, and a slim footer. Tapping the log opens the rest of the night over the bar. Checked at 360×640, 375×667 and 390×844.
- **The bar stretches, it doesn't shrink.** It is always 360 logical pixels wide. Its height is anything from 480 to 640, whatever fills the phone. The top row (bar, door) and the bottom row (smoking area, gone home) keep their size; the dancefloor and the table get the rest, and a second row of people when there is room for one.
- **Crowds squeeze before they spill.** People in an area are centred and move closer together when it fills up. Names and tags are shortened with "…" to the space each person has, and the tag is dropped when it gets too tight. People further down stand in front.
- **Scenery is flat pixel shapes, like the sprites:** bottles and a counter with taps at the bar, a lit doorway and a rope at the door, the bush with a bottle sticking out (it disappears when the bush is empty), a disco ball on the floor, a lamp over a long table, a brick wall outside, and a night sky over the people who went home. Everyone has a small shadow.
- **Palette** (`src/game/palette.ts`, mirrored in `src/ui/style.css`): the room is dark and cool (deep purple `#1A1128` / `#2A1B3F`, slate blue at the door and outside). Light is warm (lamp yellow `#FFD98A`, brass `#FFC94A`, orange door light `#FFB35C`). Wood is brown in three steps. People, want bubbles and the cream UI panels sit on top in the brightest colours. Friends have white names, strangers light blue, troublemakers pink, Simon and Anders yellow.
- **Want bubbles** are white speech bubbles with the want's icon. They turn pink, grow and shake when the want gets urgent.
- **The remix** gets coloured spotlights sweeping the dancefloor (no hard flashing), and the banner sits at the bottom of the floor so it never covers anyone. A word that pops up for several people at once, like "Øjeblikket", shows once over the whole group.

## Balance targets
Measured with `npm run sim` using an attentive autopilot, crew of five. "Sent home badly" means leaving for any reason except going home with someone or the jacuzzi afterparty (`FINE_EXITS` in `src/sim/engine.ts`). Two lightweights leaving together and the garage afterparty count as bad. Open question: should they?
- 1.3 to 2 friends sent home badly per night.
- 30 to 45% of nights with nobody sent home badly.
- Hotheads are the riskiest to bring, mums the safest.
- The director that creates wants scales to how many friends are still there. Without that, losing one friend overloaded the rest and nights collapsed.

## Decided against
- A roguelite covering ages 18 to 28, a card deck, a resource economy. Too much game, not enough night.
- Other venues (bottle clubs, forest raves, a bunker). One bar, done well.
- Decision trees across nights. Later nights read state instead.
- Visible stats and scores.
- Using the real High School Musical track or any real song in a release.
- Embedding Strudel (AGPL-3.0) or using LPC sprite packs (GPL / CC-BY-SA). Both would force licence terms on the whole game.

## Where it is going
- **Group chat intro** before the night: who's coming, whose place the warm is at, what goes in the bush, and personal goals for the night.
- **A summer of nights.** Nights read state from the ones before: bonds, one lingering condition, what the group chat remembers. No branching story.
- **Player-made crew** (names, looks, traits). The bar, Simon, Anders and the strangers stay authored.

## To-do list
Highest value for effort first. Benefit and cost scored 1 to 5.

1. **Play it together** (benefit 5, cost 1). Note which pairings fall flat and which moments land.
2. ~~Pick the engine and set up a shared repo~~ (done: this repo).
3. **More variants of the pair moments** (4, 1). Fixes repetition. Writing, not code.
4. ~~Style frame of the bar screen~~ (done: see "The bar screen" under Look. Next step is to play it on real phones and tune it by eye).
5. **Visible reactions** (4, 2). The helper walks over, both react, sounds play. Outcomes should be seen, not only read.
6. **Original remix track and sound set** (4, 2). See `audio/README.md`.
7. **Better morning-after recap** (4, 2). Better photos, reactions to messages, a slower reveal.
8. **Personal goals for the night** (3, 2). Light purpose without a score.
9. **The club as a real space** (4, 3). Distances matter: the bush is far from the bar, the smoking area is out of sight.
10. **Group chat intro** (4, 3).
11. **A minimal summer** (4, 3). Four nights, ending on the last night before people move away.
12. **A first night that teaches the game** (3, 3). Only needed for people outside the crew.
13. **The full summer** (4, 4).
14. **Store preparation** (2, 2). Age rating, parody brand names, clearly original art.
15. **Character customizer** (3, 4). Expensive, can wait.
16. **Language pass with native ears** (parked).

## Bug reports and replays
A night is decided by its seed, the crew, what carried over from the night before, and the player's taps. The game records the taps and steps the sim in fixed ticks, so the replay link (tap the seed in the footer, or on the morning screen) plays a night again exactly, at any speed. The seed alone only fixes how a night starts.

## Known loose ends
- Want bubbles use emoji. The night now waits up to 1.5 seconds for the fonts, which fixed blank bubbles in headless test browsers. Pixel icons would match the style better.
- Face expressions are a first pass; happy and sad eyes need work in the sprite lab.
- Long names are shortened with "…" when space is tight (see "The bar screen"). Short names in `content/text/da` read better than cut ones.
- The crew builder, the morning chat and the sprite lab haven't had the style-frame pass yet. Trait names are cut off in the crew builder's dropdowns on narrow phones.
- The full log over the bar shows what fits and doesn't scroll, because a scrolling box over the canvas made it go blank in Chromium.
- No licence chosen.
- No audio yet.

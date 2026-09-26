# Audio

Nothing is wired up yet. Plan:

- **Make music in Strudel, ship audio files.** Strudel is licensed AGPL-3.0. If the game embedded the Strudel engine, the whole game would have to be released under AGPL. Recording the output to audio files avoids that. Export or record each track to `.ogg` (plus `.m4a` for older iPhones) and put them in `audio/music/`.
- **The remix** is the key moment. We cannot ship the real High School Musical track, so it needs an original song in that spirit: a cheesy musical-theatre hook turned into a club remix. Keep the Strudel pattern source next to the export in `audio/src/` so it can be changed later.
- **Sound effects** (tap, success, fail, crowd cheer, glass, door) go in `audio/sfx/`. Short, small files. Only use sounds we made ourselves or that are clearly licensed for games (CC0 is simplest). Note the source of each file in `audio/CREDITS.md`.
- Phaser 4 plays audio through its sound manager; see `node_modules/phaser/skills/audio-and-sound/SKILL.md`. Browsers only allow sound after the first tap, which "Start natten" gives us.

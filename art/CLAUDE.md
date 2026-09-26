# Art

Sprites are built from text grids, so they can be drawn, reviewed and diffed like code. `npm run dev` and open `/tools/sprite-lab/` to see every part live; saving a YAML file reloads the page.

## Rules for parts
- Every part is exactly **16 wide and 24 tall**. `npm run check:content` catches wrong sizes and unknown letters.
- `.` is transparent. Draw **flat colours only**: a 1-pixel outline and lower-right shading are added by code (`src/sprites/compose.ts`, strength in `palette.yaml`).
- Layers are drawn in order: body, face, blush, hair, accessory. A later layer covers an earlier one.

## Letters
- `s` skin, `h` hair, `o` outfit: these come from each character's look.
- Fixed colours from `palette.yaml`: `e` eyes, `m` mouth, `b` blush, `p` trousers, `f` shoes, `w` white, `k` black, `y` gold, `g` banknotes.
- A part can define its own letters under `colors:`, for example `a` for an accessory colour.

## Files
- `palette.yaml` Outline colour, shading strength, fixed colours, and the skin, hair and outfit colours players can roll.
- `parts/body.yaml`, `face.yaml`, `hair.yaml`, `accessory.yaml`. Add a new hair style or accessory and it is available straight away.

## Grid map
Rows 0 to 12 are the head (row 12 is the neck), 13 to 18 the torso and arms, 19 to 22 legs and shoes, 23 empty. Eyes sit on rows 7 and 8, the mouth on rows 10 and 11.

## Asking Claude for art
Describe the look, ask for a part in this format, then check it in the sprite lab. Iterate by pasting a screenshot of the lab back. `npx tsx tools/ascii.ts` prints sprites in the terminal.

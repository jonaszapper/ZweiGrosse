# Content

Everything here is plain YAML that anyone can edit, including in the GitHub web editor. `npm run check:content` validates it and names the exact file and line of any problem.

## Files
- `traits/<id>.yaml` Mechanics per trait: skills, how often they want things, tolerance, which wants they lean towards.
- `wants/<id>.yaml` Icon and which skill handles each want. The list of wants is fixed by code.
- `strangers/<id>.yaml` Strangers. Ones with a `kind` are the troublemakers (2 or 3 per night).
- `links.yaml` Trait pairs that click or clash.
- `tuning.yaml` Balance numbers. Run `npm run sim` before and after changing them.
- `text/da/*.yaml` Every line players read, in Danish, grouped by topic. `voice.yaml` sets how each trait writes in the group chat.

## Writing text
- A key can be one line or a list. With a list, the game picks one at random, so adding variants is the easiest way to make nights feel less repetitive.
- Placeholders in curly braces are filled in by the game: `{h}` the friend who helps, `{t}` the friend who wanted something, `{s}` the stranger, `{name}`, `{names}`, `{rest}` (a follow-up sentence). Keep the placeholders that a line already uses; the check will not catch a missing one.
- Never rename or delete a key that code uses. Add new keys freely.
- Always put lines in double quotes.

## Voice
- Danish as 18 to 20 year olds in a provincial town actually talk and text. Group chat lines are lowercase, short, no full stops, with slang where it fits (skeez, bunde, i hegnet, garne, straffe floor, kniv, no cap). Log lines are short, dry and a bit funny.
- The tone is honest, not wholesome: fights, getting thrown out, arrests, being sick, heartbreak. Consequences are real but told with a wink the morning after.

## Boundaries
- No slurs on screen, ever. Racism is shown as "racistisk lort" and people reacting to it.
- Harassment (Klamme Kaj) is shown through what the friend experiences and how others react, not described in detail.
- Drugs can be offered and taken with consequences. No instructions, names of dosages or ways to get them.
- No real people's names beyond the ones already in the game (Simon, Anders) without asking them.

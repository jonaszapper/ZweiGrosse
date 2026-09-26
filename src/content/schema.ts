import { z } from 'zod';

/** Wants are wired to game logic in src/sim, so their ids are fixed here. */
export const WANT_IDS = ['beer', 'wingman', 'hug', 'backup', 'dance', 'dare', 'lost', 'bush', 'sick', 'creep', 'stand', 'afterparty'] as const;
export type WantId = (typeof WANT_IDS)[number];

export const SKILLS = ['charm', 'care', 'heat', 'wild'] as const;
export type Skill = (typeof SKILLS)[number];

export const ZONES = ['bar', 'door', 'floor', 'table', 'out', 'gone'] as const;
export type Zone = (typeof ZONES)[number];

export const ENCOUNTER_KINDS = ['creep', 'hooligan', 'racists', 'carpenter', 'gang'] as const;
export type EncounterKind = (typeof ENCOUNTER_KINDS)[number];

const skill = z.enum(SKILLS);
const wantId = z.enum(WANT_IDS);
const num = z.number();

export const TraitSchema = z.object({
  id: z.string().regex(/^[a-z]+$/),
  skills: z.object({ charm: num, care: num, heat: num, wild: num }),
  /** Charm used when talking to Simon, Anders and strangers. Defaults to charm. */
  npcCharm: num.optional(),
  /** How often this trait wants something, relative to others. */
  rate: num.positive(),
  /** How fast they get drunk. 1 is normal. */
  tolerance: num.positive(),
  /** What happens when two friends share this trait. Documentation for now; the behaviour lives in src/sim. */
  same: z.enum(['amplify', 'compete', 'bond', 'dilute']),
  /** Which wants this trait tends to have. Missing wants get a small default weight. */
  bias: z.partialRecord(wantId, num),
});
export type TraitDef = z.infer<typeof TraitSchema>;

export const WantSchema = z.object({
  id: wantId,
  icon: z.string().min(1),
  /** The skill a helper uses. */
  key: skill.optional(),
  /** Two skills: the helper's stronger one decides how they handle it (first = push, second = calm). */
  duo: z.tuple([skill, skill]).optional(),
}).refine(w => !!w.key !== !!w.duo, { message: 'A want needs exactly one of "key" or "duo"' });
export type WantDef = z.infer<typeof WantSchema>;

export const LookSchema = z.object({ skin: z.string(), hair: z.string(), hairStyle: z.string(), outfit: z.string() });
export type Look = z.infer<typeof LookSchema> & { accessory?: string; body?: string };

export const StrangerSchema = z.object({
  id: z.string().regex(/^[a-z]+$/),
  /** Encounter strangers are the troublemakers. Normal strangers have no kind. */
  kind: z.enum(ENCOUNTER_KINDS).optional(),
  trait: z.string(),
  /** How far into the night (0 to 1) before they can show up. */
  minProgress: num.min(0).max(1).optional(),
  accessory: z.string().optional(),
  look: LookSchema.optional(),
  zone: z.enum(ZONES).optional(),
});
export type StrangerDef = z.infer<typeof StrangerSchema>;

export const LinksSchema = z.object({
  clicks: z.array(z.tuple([z.string(), z.string()])),
  clashes: z.array(z.tuple([z.string(), z.string()])),
});

export const TuningSchema = z.object({
  nightLength: num.positive(),
  escalateEvery: num.positive(),
  busySeconds: num.positive(),
  flipAt: num,
  wastedAt: num,
  drinkRate: num.positive(),
  zoneDrink: z.partialRecord(z.enum(ZONES), num),
  director: z.object({
    targetOpen: z.object({ warm: num, peak: num, comedown: num }),
    chance: z.object({ warm: num, peak: num, comedown: num }),
    gap: z.object({ warm: num, peak: num, comedown: num }),
  }),
  encounters: z.object({ perNight: num.int().min(0), extraChance: num.min(0).max(1) }),
  anders: z.object({ limit: num, minLimit: num, turnAwayChance: num.min(0).max(1) }),
  fightUnseenChance: num.min(0).max(1),
});
export type Tuning = z.infer<typeof TuningSchema>;

export const VoiceSchema = z.partialRecord(z.string(), z.object({
  transform: z.enum(['upper', 'lower', 'sentence', 'typo']).optional(),
  suffix: z.array(z.string()).optional(),
}));
export type Voice = z.infer<typeof VoiceSchema>;

export const PaletteSchema = z.object({
  outline: z.string(),
  shade: num.min(0).max(1),
  fixed: z.record(z.string().length(1), z.string()),
  skins: z.array(z.string()).min(1),
  hairs: z.array(z.string()).min(1),
  outfits: z.array(z.string()).min(1),
});
export type Palette = z.infer<typeof PaletteSchema>;

/** A part is a grid of characters. "." is transparent, other characters map to colours. */
export const PartSchema = z.object({
  rows: z.array(z.string()),
  /** Colours for letters used only by this part, like "a" for an accessory. */
  colors: z.record(z.string().length(1), z.string()).optional(),
});
export const PartFileSchema = z.record(z.string(), PartSchema);
export type Part = z.infer<typeof PartSchema>;

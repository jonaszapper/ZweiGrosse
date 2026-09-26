import { parse } from 'yaml';
import type { z } from 'zod';
import {
  LinksSchema, PaletteSchema, PartFileSchema, StrangerSchema, TraitSchema, TuningSchema, VoiceSchema, WantSchema, WANT_IDS,
  type Palette, type Part, type StrangerDef, type TraitDef, type Tuning, type Voice, type WantDef, type WantId,
} from './schema';
import type { TextTable } from '../sim/text';

export interface Content {
  traits: Record<string, TraitDef>;
  wants: Record<WantId, WantDef>;
  strangers: Record<string, StrangerDef>;
  links: { clicks: [string, string][]; clashes: [string, string][] };
  tuning: Tuning;
  text: Record<string, TextTable>;
  voice: Record<string, Voice>;
  palette: Palette;
  parts: Record<string, Record<string, Part>>;
}

export class ContentError extends Error {
  constructor(public problems: string[]) { super(`Content has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`); }
}

/**
 * Builds the game content from raw YAML files.
 * `files` maps a path like "content/traits/hothead.yaml" or "art/parts/hair.yaml" to its text.
 * Throws a ContentError listing every problem with the file it came from.
 */
export function loadContent(files: Record<string, string>): Content {
  const problems: string[] = [];
  const c: Partial<Content> = { traits: {}, wants: {} as Content['wants'], strangers: {}, text: {}, voice: {}, parts: {} };

  const read = <S extends z.ZodType>(path: string, schema: S): z.infer<S> | undefined => {
    let data: unknown;
    try { data = parse(files[path]); } catch (e) { problems.push(`${path}: not valid YAML (${(e as Error).message.split('\n')[0]})`); return; }
    const r = schema.safeParse(data);
    if (!r.success) {
      r.error.issues.forEach(i => problems.push(`${path}: ${i.path.join('.') || '(file)'}: ${i.message}`));
      return;
    }
    return r.data;
  };

  for (const path of Object.keys(files).sort()) {
    const name = path.split('/').pop()!.replace(/\.ya?ml$/, '');
    if (path.startsWith('content/traits/')) {
      const d = read(path, TraitSchema); if (d) { if (d.id !== name) problems.push(`${path}: id "${d.id}" must match the file name "${name}"`); c.traits![d.id] = d; }
    } else if (path.startsWith('content/wants/')) {
      const d = read(path, WantSchema); if (d) { if (d.id !== name) problems.push(`${path}: id must match the file name`); c.wants![d.id] = d; }
    } else if (path.startsWith('content/strangers/')) {
      const d = read(path, StrangerSchema); if (d) { if (d.id !== name) problems.push(`${path}: id must match the file name`); c.strangers![d.id] = d; }
    } else if (path === 'content/links.yaml') {
      const d = read(path, LinksSchema); if (d) c.links = d as Content['links'];
    } else if (path === 'content/tuning.yaml') {
      const d = read(path, TuningSchema); if (d) c.tuning = d;
    } else if (/^content\/text\/[a-z]{2}\/voice\.ya?ml$/.test(path)) {
      const lang = path.split('/')[2]; const d = read(path, VoiceSchema); if (d) c.voice![lang] = d;
    } else if (path.startsWith('content/text/')) {
      const lang = path.split('/')[2];
      let data: unknown;
      try { data = parse(files[path]); } catch (e) { problems.push(`${path}: not valid YAML (${(e as Error).message.split('\n')[0]})`); continue; }
      const table = (c.text![lang] ??= {});
      flatten(data, '', table, path, problems);
    } else if (path === 'art/palette.yaml') {
      const d = read(path, PaletteSchema); if (d) c.palette = d;
    } else if (path.startsWith('art/parts/')) {
      const d = read(path, PartFileSchema); if (d) c.parts![name] = d;
    }
  }

  if (!c.links) problems.push('content/links.yaml is missing');
  if (!c.tuning) problems.push('content/tuning.yaml is missing');
  if (!c.palette) problems.push('art/palette.yaml is missing');
  WANT_IDS.forEach(w => { if (!c.wants![w]) problems.push(`content/wants/${w}.yaml is missing (the game logic needs it)`); });

  // Cross-references
  const traits = c.traits!;
  Object.values(traits).forEach(t => Object.keys(t.bias).forEach(w => { if (!(WANT_IDS as readonly string[]).includes(w)) problems.push(`content/traits/${t.id}.yaml: bias mentions unknown want "${w}"`); }));
  Object.values(c.strangers!).forEach(s => { if (!traits[s.trait]) problems.push(`content/strangers/${s.id}.yaml: unknown trait "${s.trait}"`); });
  c.links?.clicks.concat(c.links.clashes).forEach(([a, b]) => { [a, b].forEach(x => { if (!traits[x]) problems.push(`content/links.yaml: unknown trait "${x}"`); }); });
  checkParts(c as Content, problems);
  const hairs = Object.keys(c.parts!.hair ?? {}), accs = Object.keys(c.parts!.accessory ?? {});
  Object.values(c.strangers!).forEach(s => {
    if (s.look && s.look.hairStyle !== 'none' && !hairs.includes(s.look.hairStyle)) problems.push(`content/strangers/${s.id}.yaml: unknown hairStyle "${s.look.hairStyle}"`);
    if (s.accessory && !accs.includes(s.accessory)) problems.push(`content/strangers/${s.id}.yaml: unknown accessory "${s.accessory}"`);
  });

  if (problems.length) throw new ContentError(problems);
  return c as Content;
}

function flatten(node: unknown, prefix: string, out: TextTable, path: string, problems: string[]) {
  if (typeof node === 'string') { out[prefix] = node; return; }
  if (Array.isArray(node)) {
    if (!node.every(x => typeof x === 'string')) { problems.push(`${path}: "${prefix}" must be a list of plain lines`); return; }
    if (!node.length) { problems.push(`${path}: "${prefix}" is an empty list`); return; }
    out[prefix] = node as string[];
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (key in out) problems.push(`${path}: "${key}" is defined twice`);
      flatten(v, key, out, path, problems);
    }
    return;
  }
  problems.push(`${path}: "${prefix}" has an empty or unsupported value`);
}

export const SPRITE_W = 16, SPRITE_H = 24;

function checkParts(c: Content, problems: string[]) {
  const known = new Set(Object.keys(c.palette?.fixed ?? {}).concat(['s', 'h', 'o', '.']));
  for (const [file, parts] of Object.entries(c.parts)) {
    for (const [id, part] of Object.entries(parts)) {
      const where = `art/parts/${file}.yaml: ${id}`;
      if (part.rows.length !== SPRITE_H) problems.push(`${where} has ${part.rows.length} rows, needs ${SPRITE_H}`);
      part.rows.forEach((r, i) => {
        if (r.length !== SPRITE_W) problems.push(`${where} row ${i} is ${r.length} wide, needs ${SPRITE_W}`);
        [...r].forEach(ch => { if (!known.has(ch) && !part.colors?.[ch]) problems.push(`${where} row ${i} uses "${ch}", which has no colour`); });
      });
    }
  }
}

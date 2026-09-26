// Validates all content and art, and checks that every text key the code uses exists.
// Run: npm run check:content
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent, ContentError } from '../src/content/load';
import { readContentFiles } from './node-content';

try {
  const c = loadContent(readContentFiles());
  const used = new Set<string>();
  const walk = (d: string) => readdirSync(d).forEach(n => { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
    const src = readFileSync(p, 'utf8');
    for (const m of src.matchAll(/'((?:event|want|reason|chat|float|place|fight|ignored|recap|home|photo|word|arrive|combo|out|ui|stage)\.[\w.]+)'/g)) used.add(m[1]);
  } });
  walk('src');
  const langs = Object.keys(c.text);
  const problems: string[] = [];
  for (const lang of langs) for (const key of used) {
    // keys built from parts (like out.<want>.x) are covered by the simulation test instead
    if (!(key in c.text[lang]) && !Object.keys(c.text[lang]).some(k => k.startsWith(key + '.'))) problems.push(`content/text/${lang}: missing "${key}" (used in code)`);
  }
  if (problems.length) throw new ContentError(problems);
  console.log(`Content OK: ${Object.keys(c.traits).length} traits, ${Object.keys(c.strangers).length} strangers, ${Object.keys(c.text.da).length} Danish text keys, ${Object.values(c.parts).reduce((a, p) => a + Object.keys(p).length, 0)} sprite parts.`);
} catch (e) {
  if (e instanceof ContentError) { console.error(e.message); process.exit(1); }
  throw e;
}

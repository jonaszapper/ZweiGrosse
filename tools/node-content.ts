import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadContent } from '../src/content/load';

/** Reads every YAML file under content/ and art/ from disk. Used by tests and command-line tools. */
export function readContentFiles(root = process.cwd()) {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.ya?ml$/.test(name)) files[relative(root, p).split('\\').join('/')] = readFileSync(p, 'utf8');
    }
  };
  walk(join(root, 'content'));
  walk(join(root, 'art'));
  return files;
}

export const loadNodeContent = (root?: string) => loadContent(readContentFiles(root));

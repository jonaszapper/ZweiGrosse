import { loadContent } from './load';

/** Loads all content and art YAML files bundled by Vite. Edits to these files hot-reload in dev. */
const raw = import.meta.glob(['/content/**/*.yaml', '/art/**/*.yaml'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const files = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.replace(/^\//, ''), v]));
export const content = loadContent(files);

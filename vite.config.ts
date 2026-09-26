import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: {
    rolldownOptions: {
      input: {
        game: resolve(import.meta.dirname, 'index.html'),
        lab: resolve(import.meta.dirname, 'tools/sprite-lab/index.html'),
      },
    },
    chunkSizeWarningLimit: 2000,
  },
  test: { include: ['tests/**/*.test.ts'] },
});

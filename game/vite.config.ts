import { defineConfig } from 'vitest/config';

// `vite build --mode package` emits one JS chunk so tools/package.mjs can inline it into a single HTML file.
export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: '127.0.0.1', port: 5190 },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rolldownOptions: mode === 'package' ? { output: { codeSplitting: false } } : {},
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The persistent transform cache misses import.meta.glob changes and is shared by all worktrees.
    fsModuleCache: false,
  },
}));

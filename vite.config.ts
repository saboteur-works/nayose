import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'src/renderer'),
  base: './',
  // Task 2 (Saboteur design system integration) adds the Tailwind v4 Vite
  // plugin here. This is the one narrowly-scoped exception to "do not
  // touch Task-1 files" called out in that task's brief.
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // Relative base so the build runs from any subpath (GitHub Pages project site,
  // itch.io, CrazyGames CDN, …) without hardcoding the repo name. Dev stays at '/'.
  base: command === 'build' ? './' : '/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true, port: 5173 },
  build: { target: 'esnext', sourcemap: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
}));

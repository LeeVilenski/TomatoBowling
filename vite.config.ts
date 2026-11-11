import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

const rapierWeb = fileURLToPath(new URL('./src/game/rapierWeb.ts', import.meta.url));

export default defineConfig({
  plugins: [wasm()],
  resolve: {
    // Browser builds use the physics engine with a separate, streamed .wasm file instead of
    // the one inlined as base64 (see src/game/rapierWeb.ts). Unit tests keep the compat one.
    alias: process.env.VITEST ? {} : { '@dimforge/rapier3d-compat': rapierWeb },
  },
  build: {
    // Three.js on its own is ~580 kB (145 kB gzipped); that's expected
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        // Three.js changes far less often than the game, so it gets its own long-cached file
        codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }] },
      },
    },
  },
});

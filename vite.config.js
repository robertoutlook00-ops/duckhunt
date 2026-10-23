import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the production build works from any sub-path.
  base: './',
  // PixiJS 4 is a legacy UMD bundle that references Node's `global`.
  define: { global: 'globalThis' },
  optimizeDeps: { esbuildOptions: { define: { global: 'globalThis' } } },
  build: {
    // Keep images and sounds as separate hashed files instead of inlining them.
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200
  }
});

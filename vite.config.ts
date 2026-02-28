import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const sharedCacheDir =
  process.env.VITE_CACHE_DIR ?? path.join(os.tmpdir(), 'ST_Dashboard_vite_cache');

export default defineConfig({
  plugins: [react()],
  cacheDir: sharedCacheDir,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

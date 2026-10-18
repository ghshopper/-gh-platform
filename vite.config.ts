import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served by Laravel at the site root; files live in public/site.
export default defineConfig({
  base: '/site/',
  plugins: [react()],
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
  server: { proxy: { '/api': 'https://ghshopper.com', '/storage': 'https://ghshopper.com' } },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // dist/ is opened from appendix/website and may be hosted below a sub-path,
  // so asset URLs must stay relative to index.html.
  base: './',
  server: { host: '127.0.0.1', port: 3021 },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

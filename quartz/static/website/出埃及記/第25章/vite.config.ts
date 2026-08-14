import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The build is copied under appendix/website (and may be hosted below a
  // repository or chapter path), so production asset URLs must stay relative
  // to the generated index.html.
  base: './',
  server: {
    host: '127.0.0.1',
    port: 3001,
  },
  build: {
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

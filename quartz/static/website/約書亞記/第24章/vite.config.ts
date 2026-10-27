import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 相對路徑支援整個 dist 複製到靜態主機的子目錄。
  base: './',
  server: { host: '127.0.0.1', port: 3024 },
  preview: { host: '127.0.0.1', port: 4224 },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

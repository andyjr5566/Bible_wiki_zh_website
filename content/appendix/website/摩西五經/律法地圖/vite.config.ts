import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // 從 Obsidian 點連結會以 file:// 打開 dist/index.html。外部 <script type="module" src>
  // 在 file:// 下會被瀏覽器擋，所以把 JS、CSS、資料全部內嵌成單一 HTML。
  base: './',
  plugins: [viteSingleFile()],
  server: { host: '127.0.0.1', port: 3051 },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

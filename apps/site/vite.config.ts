import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * 官网构建：两个独立 entry。
 * - index.html 公开页面（/、/install、/help、/privacy），加载 analytics；
 * - app.html    `/app` 静态外壳，独立 entry，物理排除 Umami tracker。
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
      },
    },
  },
  esbuild: { jsx: 'automatic' },
});

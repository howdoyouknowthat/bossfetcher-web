import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildMetadata, APP_VERSION_FULL, SITE_ORIGIN } from './src/metadata';

/**
 * 用户脚本构建：输出单文件 bossfetcher.user.js（IIFE，内联 React 与全部包）。
 * 元数据块（==UserScript==）在 closeBundle 时置顶，确保 Tampermonkey 识别。
 * 生产页面的运行时依赖不来自公共 CDN。
 */
function userscriptBanner(): Plugin {
  return {
    name: 'bossfetcher-userscript-banner',
    closeBundle() {
      const file = resolve(__dirname, 'dist', 'bossfetcher.user.js');
      const content = readFileSync(file, 'utf8');
      if (content.startsWith('// ==UserScript==')) return;
      writeFileSync(file, buildMetadata(APP_VERSION_FULL) + content);
    },
  };
}

export default defineConfig({
  define: {
    __BOSSFETCHER_SITE_ORIGIN__: JSON.stringify(process.env.BOSSFETCHER_SITE_ORIGIN || SITE_ORIGIN),
  },
  build: {
    lib: {
      entry: 'src/main.ts',
      formats: ['iife'],
      name: 'BossFetcher',
      fileName: () => 'bossfetcher.user.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [userscriptBanner()],
  esbuild: { jsx: 'automatic' },
});

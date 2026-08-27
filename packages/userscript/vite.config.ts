import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildMetadata } from './src/metadata';

/**
 * 用户脚本构建：输出单文件 bossfetcher.user.js（IIFE，内联 React 与全部包）。
 * 元数据块（==UserScript==）在 closeBundle 时置顶，确保 Tampermonkey 识别。
 * 生产页面的运行时依赖不来自公共 CDN。
 *
 * 注意：本文件在 Node ESM 加载阶段执行，只允许 import 无裸依赖的本地模块
 * （Node 20 无法加载 workspace 内 .ts 包的裸导入）。版本号从 contracts
 * 源码读取，与 scripts/verify-release.mjs 使用同一正则真源。
 */
const APP_VERSION = /APP_VERSION = '([^']+)'/.exec(
  readFileSync(resolve(__dirname, '../contracts/src/index.ts'), 'utf8'),
)?.[1] ?? '';
if (!APP_VERSION) {
  throw new Error('未能在 packages/contracts/src/index.ts 中找到 APP_VERSION');
}

const SITE_ORIGIN = process.env.BOSSFETCHER_SITE_ORIGIN || 'https://www.bossfetcher.icu';

function userscriptBanner(): Plugin {
  return {
    name: 'bossfetcher-userscript-banner',
    closeBundle() {
      const file = resolve(__dirname, 'dist', 'bossfetcher.user.js');
      const content = readFileSync(file, 'utf8');
      if (content.startsWith('// ==UserScript==')) return;
      writeFileSync(file, buildMetadata(APP_VERSION, SITE_ORIGIN) + content);
    },
  };
}

export default defineConfig({
  define: {
    __BOSSFETCHER_SITE_ORIGIN__: JSON.stringify(SITE_ORIGIN),
    __BOSSFETCHER_APP_VERSION__: JSON.stringify(APP_VERSION),
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

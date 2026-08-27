/**
 * `/app` 静态外壳入口。
 *
 * 本 entry 不导入 analytics 模块（site/main.tsx 是唯一统计入口），
 * 保证构建产物在物理上排除 Umami tracker、website id 与任何统计调用。
 * 结果界面由 BossFetcher 用户脚本在 #root 挂载。
 */
import '@bossfetcher/dashboard/styles.css';

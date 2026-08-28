import { expect, test } from '@playwright/test';

test('public routes render and app shell contains no tracker', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '把 BOSS 直聘页面，变成你自己的岗位库' })).toBeVisible();
  if (process.env.VITE_ICP_NUMBER) {
    await expect(page.getByRole('link', { name: process.env.VITE_ICP_NUMBER })).toHaveAttribute(
      'href',
      'https://beian.miit.gov.cn/',
    );
  }

  await page.goto('/install');
  await expect(page.getByRole('heading', { name: '安装向导' })).toBeVisible();

  const appRequests: string[] = [];
  page.on('request', (request) => appRequests.push(request.url()));
  await page.goto('/app');
  await expect(page.getByText('还没有检测到 BossFetcher 脚本')).toBeVisible();
  expect(appRequests.some((url) => url.includes('umami') || url.includes('stats.bossfetcher.icu'))).toBe(false);
});

test('opt-out persists and blocks tracker requests after reload', async ({ page }) => {
  const statsRequests: string[] = [];
  await page.route('https://stats.bossfetcher.icu/**', async (route) => {
    statsRequests.push(route.request().url());
    await route.abort();
  });

  await page.goto('/privacy');
  statsRequests.length = 0;
  await page.getByRole('button', { name: '关闭网站统计' }).click();
  await expect(page.getByText('你已退出网站统计')).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('bf.analytics_opt_out'))).toBe('1');
  expect(statsRequests).toHaveLength(0);
});

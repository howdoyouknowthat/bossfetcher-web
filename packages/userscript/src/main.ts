import { createRepository, MigrationError } from '@bossfetcher/repository';
import { CaptureController, configFromLimits } from '@bossfetcher/capture';
import { createGMCaptureDriver } from './gm-driver';
import { BOSSPanel } from './panel';
import { injectSiteReadyMarker, isAppPath, isSiteOrigin, isZhipin } from './site-ready';
import { bootDashboard } from './dashboard-bootstrap';
import { createBossFetcherStore } from './bf-store';

function bootCapture(): void {
  const store = createBossFetcherStore();
  const repo = createRepository(store);

  repo
    .init()
    .then(() => {
      const limits = repo.getSettings().captureLimits;
      let panel: BOSSPanel | null = null;
      const driver = createGMCaptureDriver({
        onReport: (st) => panel?.render(st),
        onRun: (st) => panel?.render(st),
      });
      const controller = new CaptureController(repo, driver, configFromLimits(limits));

      panel = new BOSSPanel(controller);
      panel.mount();
      panel.render(repo.getCaptureState());

      // 页面加载后自动恢复运行中的采集
      const st = repo.getCaptureState();
      if (st.status === 'running') {
        window.setTimeout(() => controller.runAuto(), 900 + Math.floor(Math.random() * 900));
      }
    })
    .catch((e: unknown) => {
      if (e instanceof MigrationError) {
        console.warn('[BossFetcher]', e.message);
      } else {
        console.warn('[BossFetcher] 本地存储初始化失败：', e);
      }
    });
}

function onPageReady(): void {
  if (isZhipin()) {
    bootCapture();
    return;
  }
  if (isSiteOrigin()) {
    if (isAppPath()) {
      void bootDashboard();
    } else {
      injectSiteReadyMarker();
    }
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  onPageReady();
} else {
  window.addEventListener('DOMContentLoaded', onPageReady);
}

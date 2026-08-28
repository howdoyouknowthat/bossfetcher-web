import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('ICP备案页脚', () => {
  it('显示备案号原文并链接工信部备案系统', () => {
    const html = renderToStaticMarkup(<App pathname="/" icpNumber="粤ICP备12345678号-1" />);

    expect(html).toContain('粤ICP备12345678号-1');
    expect(html).toContain('href="https://beian.miit.gov.cn/"');
  });

  it('未注入备案号时不显示空链接', () => {
    const html = renderToStaticMarkup(<App pathname="/" icpNumber="" />);

    expect(html).not.toContain('beian.miit.gov.cn');
  });

  it('隐私页披露 Umami 标准 tracker 字段', () => {
    const html = renderToStaticMarkup(<App pathname="/privacy" icpNumber="皖ICP备2026028506号" />);

    expect(html).toContain('公开页面标题');
    expect(html).toContain('浏览器语言');
    expect(html).toContain('屏幕尺寸');
    expect(html).toContain('来源页');
    expect(html).not.toContain('统计请求只包含固定事件名与规范化路径');
  });
});

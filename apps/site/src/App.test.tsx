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
});

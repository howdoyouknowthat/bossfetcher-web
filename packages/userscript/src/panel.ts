import type { CaptureStateV1 } from '@bossfetcher/contracts';
import type { CaptureController } from '@bossfetcher/capture';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  if (text !== undefined) node.textContent = text;
  return node;
}

const PANEL_ID = 'bossfetcher-panel';
const MINI_ID = 'bossfetcher-mini';

export class BOSSPanel {
  private panel: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private progressEl: HTMLElement | null = null;
  private mini: HTMLElement | null = null;

  constructor(private controller: CaptureController) {}

  mount(): void {
    if (!document.body || document.getElementById(PANEL_ID)) return;

    const box = el('div', {
      position: 'fixed',
      right: '14px',
      bottom: '14px',
      zIndex: '2147483647',
      font: '12px/1.5 -apple-system,BlinkMacSystemFont,sans-serif',
      textAlign: 'right',
      color: '#222',
    });
    box.id = PANEL_ID;

    const startBtn = this.button('开始', '#10a37f', () => this.controller.start());
    const pauseBtn = this.button('暂停', '#6b7280', () => this.controller.pause());
    const manualBtn = this.button('抓本页', '#2563eb', () => this.controller.captureManual());
    const collapseBtn = this.button('−', '#9ca3af', () => this.collapse());
    collapseBtn.style.fontSize = '16px';
    collapseBtn.style.lineHeight = '1';
    collapseBtn.style.minWidth = '32px';
    collapseBtn.title = '最小化面板';

    this.progressEl = el('div', {
      marginTop: '6px',
      background: '#fff',
      padding: '4px 7px',
      borderRadius: '4px',
      display: 'inline-block',
      boxShadow: '0 1px 4px rgba(0,0,0,.15)',
      maxWidth: '360px',
    });
    this.statusEl = el('div', {
      marginTop: '4px',
      background: '#fff',
      padding: '4px 7px',
      borderRadius: '4px',
      display: 'inline-block',
      boxShadow: '0 1px 4px rgba(0,0,0,.15)',
      maxWidth: '360px',
      wordBreak: 'break-all',
    });

    box.append(startBtn, pauseBtn, manualBtn, collapseBtn, document.createElement('br'), this.progressEl, document.createElement('br'), this.statusEl);
    document.body.appendChild(box);
    this.panel = box;
    this.render(this.controller.progress().label === '' ? undefined : undefined);
  }

  private button(text: string, bg: string, onClick: () => void): HTMLButtonElement {
    const btn = el('button', {
      marginLeft: '6px',
      background: bg,
      color: '#fff',
      border: '0',
      padding: '7px 10px',
      borderRadius: '6px',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,.22)',
    }, text);
    btn.addEventListener('click', onClick);
    return btn;
  }

  render(state: CaptureStateV1 | undefined): void {
    if (!this.panel) return;
    const st = state;
    if (st && this.progressEl) {
      const done = (st.queueTotal || 0) - st.queue.length;
      this.progressEl.textContent =
        `状态：${statusLabel(st.status)}｜已抓：${st.dailyCount}｜队列：${done}/${st.queueTotal || 0}｜剩余：${st.queue.length}`;
    }
    if (st && this.statusEl) this.statusEl.textContent = st.lastMessage || '就绪';
  }

  collapse(): void {
    if (this.panel) this.panel.style.display = 'none';
    this.mountMini();
  }

  private mountMini(): void {
    if (this.mini || document.getElementById(MINI_ID)) return;
    const dot = el('div', {
      position: 'fixed',
      right: '14px',
      bottom: '14px',
      zIndex: '2147483646',
      width: '42px',
      height: '42px',
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 2px 10px rgba(0,0,0,.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '700',
      color: '#222',
      border: '2px solid #e0e0e0',
    }, 'BF');
    dot.id = MINI_ID;
    dot.addEventListener('click', () => this.expand());
    document.body.appendChild(dot);
    this.mini = dot;
  }

  private expand(): void {
    if (this.panel) this.panel.style.display = '';
    if (this.mini) {
      this.mini.remove();
      this.mini = null;
    }
  }
}

function statusLabel(status: string): string {
  if (status === 'running') return '运行中';
  if (status === 'paused') return '已暂停';
  if (status === 'completed') return '已完成';
  if (status === 'error') return '出错';
  return '空闲';
}

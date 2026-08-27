import { useEffect, useState } from 'react';
import { getAnalytics } from '../analytics-init';

function isSupportedDesktop(): boolean {
  const ua = navigator.userAgent;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  if (mobile) return false;
  const isChromium = /Chrome\/|Edg\//.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isSafari = !isChromium && !isFirefox && /Safari\//.test(ua);
  return isChromium && !isSafari;
}

function detectScriptReady(): { ready: boolean; version: string } {
  const el = document.documentElement;
  return { ready: el.getAttribute('data-bossfetcher-ready') === '1', version: el.getAttribute('data-bossfetcher-version') || '' };
}

type Step = 'tampermonkey' | 'allow-scripts' | 'install-script' | 'detected' | 'unsupported';

const TM_STORE = 'https://www.tampermonkey.net/';
const ALLOW_USER_SCRIPTS_HELP = 'https://www.tampermonkey.net/faq.php?q=Q209';
const BOSS_JOBS = 'https://www.zhipin.com/web/geek/jobs';

export function InstallPage() {
  const analytics = getAnalytics();
  const [supported] = useState(() => isSupportedDesktop());
  const [step, setStep] = useState<Step>(supported ? 'tampermonkey' : 'unsupported');
  const [scriptVersion, setScriptVersion] = useState('');

  useEffect(() => {
    if (step !== 'install-script') return;
    const t = setInterval(() => {
      const r = detectScriptReady();
      if (r.ready) {
        setScriptVersion(r.version);
        setStep('detected');
        analytics.trackEvent('userscript_ready_detected');
        clearInterval(t);
      }
    }, 1500);
    return () => clearInterval(t);
  }, [step, analytics]);

  function recheck() {
    const r = detectScriptReady();
    if (r.ready) {
      setScriptVersion(r.version);
      setStep('detected');
      analytics.trackEvent('userscript_ready_detected');
    } else {
      analytics.trackEvent('install_retry_click');
      setStep('install-script');
    }
  }

  if (step === 'unsupported') {
    return (
      <div>
        <h1>暂不支持当前浏览器</h1>
        <p className="sub">
          第一版支持桌面端 Chrome 与 Edge。Firefox、Safari 与手机端暂不在支持范围，请更换浏览器后再来安装。
        </p>
      </div>
    );
  }

  const steps: Array<{ dot: string; title: string; body: React.ReactNode }> = [
    {
      dot: step === 'tampermonkey' ? '1' : '✓',
      title: '安装 Tampermonkey',
      body: (
        <>
          <p>请只从 Tampermonkey 官方网站或浏览器扩展商店安装，避免搜索到仿冒扩展。</p>
          <button
            className="btn"
            onClick={() => {
              analytics.trackEvent('tampermonkey_store_open');
              window.open(TM_STORE, '_blank', 'noopener');
            }}
          >
            打开 Tampermonkey 官方入口
          </button>
          <button className="btn ghost" style={{ marginLeft: 10 }} onClick={() => { analytics.trackEvent('install_help_open'); window.location.href = '/help#tampermonkey'; }}>
            查看图文说明
          </button>
          <div style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={() => setStep('allow-scripts')}>我已完成，下一步</button>
          </div>
        </>
      ),
    },
    {
      dot: step === 'allow-scripts' ? '2' : '✓',
      title: '开启“允许用户脚本”权限',
      body: (
        <>
          <p>新版 Chrome 默认不允许扩展运行用户脚本，需要手动开启。安装 Tampermonkey 后，扩展详情页会显示“允许用户脚本”开关。</p>
          <button className="btn" onClick={() => { analytics.trackEvent('allow_user_scripts_help_open'); window.open(ALLOW_USER_SCRIPTS_HELP, '_blank', 'noopener'); }}>
            打开官方说明
          </button>
          <div style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={() => setStep('install-script')}>我已开启，下一步</button>
          </div>
        </>
      ),
    },
    {
      dot: step === 'install-script' ? '3' : '✓',
      title: '安装 BossFetcher 脚本',
      body: (
        <>
          <p>点击下方按钮，Tampermonkey 会打开安装确认页，确认后脚本即安装完成。如果无法访问扩展商店，请参照帮助页的诚实说明。</p>
          <a className="btn" href="/bossfetcher.user.js" onClick={() => analytics.trackEvent('userscript_install_open')}>
            安装 BossFetcher 脚本
          </a>
          <div style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={recheck}>我已安装，重新检测</button>
          </div>
          <p className="sub" style={{ marginTop: 8 }}>安装后脚本会自动运行，本页会检测到并跳到下一步。</p>
        </>
      ),
    },
  ];

  return (
    <div>
      <h1>安装向导</h1>
      <p className="sub">全新用户大约需要 5 分钟。每一步都需要你明确确认，不做虚假进度。</p>

      {steps.map((s) => (
        <div className="guide-step" key={s.title}>
          <div className="dot">{s.dot}</div>
          <div>
            <h3>{s.title}</h3>
            {s.body}
          </div>
        </div>
      ))}

      {step === 'detected' ? (
        <div className="guide-step">
          <div className="dot">✓</div>
          <div>
            <h3>脚本已就绪</h3>
            <p>检测到 BossFetcher 脚本版本 <strong>{scriptVersion || '未知'}</strong>。接下来：</p>
            <ul style={{ color: 'var(--text-2)', fontSize: 14 }}>
              <li>打开 BOSS 直聘，自行登录（BossFetcher 不接触你的账号凭据）；</li>
              <li>搜索一个岗位关键词进入列表页；</li>
              <li>点击右下角绿色“开始”，脚本会按人速自动采集；</li>
              <li>回到“我的岗位库”查看结果，数据只保存在你的浏览器。</li>
            </ul>
            <a className="btn" href={BOSS_JOBS} target="_blank" rel="noreferrer" onClick={() => analytics.trackEvent('boss_site_open')}>
              打开 BOSS 直聘
            </a>
            <a className="btn ghost" style={{ marginLeft: 10 }} href="/app" onClick={() => analytics.trackEvent('dashboard_open_click')}>
              查看我的岗位库
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

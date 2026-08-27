export type InstallStep = 'tampermonkey' | 'allow-scripts' | 'install-script' | 'detected' | 'unsupported';
export type InstallStepStatus = 'complete' | 'current' | 'upcoming';

const ORDER: Record<Exclude<InstallStep, 'unsupported'>, number> = {
  tampermonkey: 0,
  'allow-scripts': 1,
  'install-script': 2,
  detected: 3,
};

/**
 * 安装向导步骤状态：只把「用户已明确确认」的上一步标记为完成，
 * 绝不把未来步骤标记为完成（诚实进度）。
 */
export function installStepStatus(
  current: InstallStep,
  target: Exclude<InstallStep, 'detected' | 'unsupported'>,
): InstallStepStatus {
  if (current === 'unsupported') return 'upcoming';
  if (ORDER[target] < ORDER[current]) return 'complete';
  if (target === current) return 'current';
  return 'upcoming';
}

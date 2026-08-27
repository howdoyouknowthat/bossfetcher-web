import { describe, expect, it } from 'vitest';
import { installStepStatus } from './install-state';

describe('installStepStatus', () => {
  it('does not mark future steps complete', () => {
    expect(installStepStatus('tampermonkey', 'tampermonkey')).toBe('current');
    expect(installStepStatus('tampermonkey', 'allow-scripts')).toBe('upcoming');
    expect(installStepStatus('tampermonkey', 'install-script')).toBe('upcoming');
  });

  it('marks only confirmed earlier steps complete', () => {
    expect(installStepStatus('install-script', 'tampermonkey')).toBe('complete');
    expect(installStepStatus('install-script', 'allow-scripts')).toBe('complete');
    expect(installStepStatus('install-script', 'install-script')).toBe('current');
  });

  it('marks all three setup steps complete after ready detection', () => {
    expect(installStepStatus('detected', 'tampermonkey')).toBe('complete');
    expect(installStepStatus('detected', 'allow-scripts')).toBe('complete');
    expect(installStepStatus('detected', 'install-script')).toBe('complete');
  });
});

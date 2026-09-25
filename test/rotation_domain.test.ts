import { describe, expect, it } from 'vitest';
import { assessRotationRisk } from '../src/rotation_domain';

describe('assessRotationRisk', () => {
  it('extends overlap when deployments still use the old key during the patient impact window', () => {
    const result = assessRotationRisk({
      integrationName: 'appointments-api',
      patientImpactWindowMinutes: 30,
      graceHours: 1,
      deploymentsUsingOldKey: ['web-1', 'worker-2']
    });

    expect(result.decision).toBe('extend-overlap');
    expect(result.severity).toBe('warning');
    expect(result.notifications[1]).toContain('web-1, worker-2');
  });
});

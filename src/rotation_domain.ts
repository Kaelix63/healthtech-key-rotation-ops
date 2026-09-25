export type RotationAssessmentInput = {
  patientImpactWindowMinutes: number;
  graceHours: number;
  deploymentsUsingOldKey: string[];
  integrationName: string;
};

export type RotationAssessment = {
  decision: 'complete-cutover' | 'extend-overlap';
  severity: 'info' | 'warning';
  summary: string;
  notifications: string[];
};

export function assessRotationRisk(input: RotationAssessmentInput): RotationAssessment {
  const overlappingMinutes = input.graceHours * 60;
  const stillUsingOldKey = input.deploymentsUsingOldKey.length > 0;
  const overlapTooShort = overlappingMinutes < input.patientImpactWindowMinutes;

  if (stillUsingOldKey || overlapTooShort) {
    const reasons: string[] = [];
    if (stillUsingOldKey) {
      reasons.push(`deployments still using the old key: ${input.deploymentsUsingOldKey.join(', ')}`);
    }
    if (overlapTooShort) {
      reasons.push(`grace window ${input.graceHours}h is shorter than the ${input.patientImpactWindowMinutes} minute patient impact window`);
    }

    return {
      decision: 'extend-overlap',
      severity: 'warning',
      summary: `Keep overlap active for ${input.integrationName}`,
      notifications: [
        `Patient-safe notice: keep both keys valid while appointments continue to sync.`,
        `Ops follow-up: ${reasons.join('; ')}.`
      ]
    };
  }

  return {
    decision: 'complete-cutover',
    severity: 'info',
    summary: `Cut over ${input.integrationName} after the grace window`,
    notifications: [
      'Patient-safe notice: no deployments were seen using the old key during the check window.',
      'Ops follow-up: proceed with the planned cutover after the overlap period ends.'
    ]
  };
}

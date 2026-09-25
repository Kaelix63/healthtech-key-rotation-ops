import { z } from 'zod';
import { assessRotationRisk } from './rotation_domain';
import type { InfraiClient } from './infrai_client';

export const rotationRequestSchema = z.object({
  integrationName: z.string().min(1),
  patientImpactWindowMinutes: z.number().int().positive(),
  oldKeyId: z.string().min(1),
  oldKeyFingerprint: z.string().min(1),
  graceHours: z.number().int().positive(),
  deploymentLogQuery: z.string().min(1),
  projectId: z.string().min(1).optional()
});

export type RotationRequest = z.infer<typeof rotationRequestSchema>;

function makeIdempotencyKey(prefix: string, request: RotationRequest): string {
  return `${prefix}:${request.integrationName}:${request.oldKeyId}:${request.graceHours}`;
}

function collectDeploymentNames(logData: unknown): string[] {
  if (!Array.isArray(logData)) {
    return [];
  }

  const names = new Set<string>();
  for (const item of logData) {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      if (typeof record.deployment === 'string' && record.deployment.length > 0) {
        names.add(record.deployment);
      }
    }
  }
  return [...names];
}

export async function runHealthtechKeyRotation(infrai: InfraiClient, input: RotationRequest) {
  const request = rotationRequestSchema.parse(input);

  const tempKey = await infrai.account.keys.create({
    project_id: request.projectId,
    name: `${request.integrationName}-rotation-temporary`,
    scopes: ['logs.search', 'account.keys.rotate'],
    idempotency_key: makeIdempotencyKey('create-temp-key', request)
  });

  const rotated = await infrai.account.keys.rotate(tempKey.id, {
    grace_hours: request.graceHours,
    idempotency_key: makeIdempotencyKey('rotate-temp-key', request)
  });

  const logData = await infrai.logs.search({ q: request.deploymentLogQuery });
  const deploymentsUsingOldKey = collectDeploymentNames(logData);

  const assessment = assessRotationRisk({
    patientImpactWindowMinutes: request.patientImpactWindowMinutes,
    graceHours: request.graceHours,
    deploymentsUsingOldKey,
    integrationName: request.integrationName
  });

  return {
    integrationName: request.integrationName,
    rotationStatus: 'grace-period-active',
    oldKeyId: request.oldKeyId,
    temporaryKeyId: tempKey.id,
    rotatedKeyId: rotated.id,
    overlapHours: request.graceHours,
    deploymentsUsingOldKey,
    decision: assessment.decision,
    severity: assessment.severity,
    notifications: assessment.notifications
  };
}

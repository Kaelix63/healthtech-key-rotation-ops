import { infrai } from './infrai_client';
import { runHealthtechKeyRotation } from './healthtech_rotation_service';

async function main() {
  const result = await runHealthtechKeyRotation(infrai, {
    integrationName: 'appointments-api',
    patientImpactWindowMinutes: 30,
    oldKeyId: 'replace-with-existing-key-id',
    oldKeyFingerprint: 'replace-with-old-key-fingerprint',
    graceHours: 6,
    deploymentLogQuery: 'replace-with-old-key-fingerprint'
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

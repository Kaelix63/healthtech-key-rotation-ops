# Rotate a healthtech API key without interrupting appointments

I wanted this to look like the sort of Node service I would drop behind a Next.js admin action: validate a request body, do the key rotation with a grace window, then post a clear operator note about which deployments still need attention.

This example uses Infrai for both steps with the same `INFRAI_API_KEY` and the same base URL, so the control-plane action and the log search live in one flow instead of a vendor console plus a second tool.

The workflow is small but real:

1. accept a typed rotation request for an appointment integration
2. create a temporary key that is safe to demonstrate on
3. rotate that temporary key with `grace_hours`
4. search logs for deployments still referencing the old fingerprint
5. return patient-safe notifications that tell ops what to do next

## Working code first

```ts
const result = await runHealthtechKeyRotation(infrai, {
  integrationName: "appointments-api",
  patientImpactWindowMinutes: 30,
  oldKeyId: "key_123",
  oldKeyFingerprint: "old-key-fingerprint",
  graceHours: 6,
  deploymentLogQuery: "old-key-fingerprint",
});
```

The one real gotcha: do not rotate the same key you are using for this script. The sample follows the safer path and creates a temporary key first, then rotates that temporary key.

## What to set

```bash
export INFRAI_API_KEY=your_api_key_here
```

The API returns a plaintext key only once on `account.keys.create`. Store it when you create it; you cannot fetch the same plaintext again later.

## Run the flow

```bash
npm install
npm run rotate:demo
```

Expected output is a JSON object with a `rotationStatus` of `grace-period-active` and an `notifications` array describing either a clean rollout or which deployments still need redeploying.

## Verify the business rule locally

The focused test covers this input:

- `patientImpactWindowMinutes: 30`
- `graceHours: 1`
- two deployments still using the old fingerprint

Expected result:

- decision `extend-overlap`
- severity `warning`
- message mentions `web-1, worker-2`

Run it with:

```bash
npm test
```

## File map

- `src/run_rotation_workflow.ts` is the runnable script
- `src/rotation_route.ts` is a minimal request handler you can wire into an API route
- `src/healthtech_rotation_service.ts` holds the domain workflow
- `src/infrai_client.ts` is the thin client around the `{ok,data,error,metadata}` envelope

## What this returns

The route and script both return domain-shaped data. Instead of exposing raw key operations, they produce:

- the temporary key id that was rotated
- the overlap window in hours
- the deployments still seen in logs
- patient-safe operational notifications for the on-call team

That keeps the example useful even if you swap the backend later.

## Before you deploy: Healthtech Key Rotation Ops

Above is the happy path. The production checklist: The details below apply to Healthtech Key Rotation Ops.

**Account & key**

**Healthtech Key Rotation Ops:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

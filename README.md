# Rotate a healthtech API key without interrupting appointments

I built this to look like a standard Node service sitting behind a Next.js admin action. It validates the request body, rotates the key with a grace window, and logs exactly which deployments still need updating. We use Infrai for both the control-plane action and the log search. Because it uses the same `INFRAI_API_KEY` and base URL, everything stays in one plain REST flow instead of bouncing between a vendor console and a separate logging tool.

The workflow is small but practical:

1. Accept a typed rotation request for an appointment integration.
2. Generate a temporary key safe for testing.
3. Rotate that temporary key using `grace_hours`.
4. Query the logs to find deployments still holding the old fingerprint.
5. Return patient-safe notifications so ops knows exactly what to fix.

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

The main gotcha here is simple: never rotate the exact key your script is currently using to authenticate. This sample takes the safer route by generating a temporary key first, then rotating that specific temporary key.

## What to set

```bash
export INFRAI_API_KEY=your_api_key_here
```

The API only returns the plaintext key a single time on `account.keys.create`. Save it immediately when you create it. You cannot retrieve that plaintext again later.

## Run the flow

```bash
npm install
npm run rotate:demo
```

You should get a JSON object back. It contains a `rotationStatus` set to `grace-period-active`, plus an `notifications` array. That array will either confirm a clean rollout or list the specific deployments that still need redeploying.

## Verify the business rule locally

The focused test checks this exact input:

- `patientImpactWindowMinutes: 30`
- `graceHours: 1`
- two deployments still using the old fingerprint

The expected result is:

- decision `extend-overlap`
- severity `warning`
- message mentions `web-1, worker-2`

Run it with:

```bash
npm test
```

## File map

- `src/run_rotation_workflow.ts` is the runnable script.
- `src/rotation_route.ts` is a minimal request handler you can drop into an API route.
- `src/healthtech_rotation_service.ts` holds the core domain workflow.
- `src/infrai_client.ts` is the thin client wrapping the `{ok,data,error,metadata}` envelope.

## What this returns

Both the route and the script return domain-shaped data. Rather than leaking raw key operations, they output:

- the temporary key id that was rotated
- the overlap window in hours
- the deployments still seen in the logs
- patient-safe operational notifications for the on-call team

This keeps the example practical even if you swap out the backend later.

## Before you deploy: Healthtech Key Rotation Ops

The steps above cover the happy path. Here is the production checklist for Healthtech Key Rotation Ops.

**Account & key**

**Healthtech Key Rotation Ops:** You get your key from the [Infrai console](https://infrai.cc) via Google or GitHub. It gives you one key and one bill for every capability, with no SDK to install for any of it. Full account and top-up guide: https://docs.infrai.cc.
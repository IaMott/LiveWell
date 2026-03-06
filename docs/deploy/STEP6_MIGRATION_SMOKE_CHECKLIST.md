# Step 6 Deploy Checklist

## 1) Pre-deploy checks

- Ensure branch is up to date with `main`.
- Run local verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
- Confirm Prisma client is generated:
  - `npx prisma generate`

## 2) Migration deploy

- Apply database migrations on target environment:
  - `npx prisma migrate deploy`
- Verify new tables exist:
  - `confirm_actions`
  - `tool_audit_logs`

## 3) Required environment/runtime checks

- Confirm `DATABASE_URL` is configured.
- Confirm API runtime can access DB from the deploy environment.
- Confirm no client-side secret exposure in `/api/chat/send` and `/api/live-token`.

## 4) Post-deploy smoke tests

- API auth/rate-limit baseline:
  - `POST /api/chat/send` without `x-user-id` => `401`
  - burst requests => `429` after threshold
- Confirm flow regression:
  - `share.createLink` as non-owner => `FORBIDDEN`
  - `share.createLink` owner mode off => `OWNER_MODE_REQUIRED`
  - first call without confirm => `CONFIRMATION_REQUIRED` + `confirmToken`
  - second call with valid `confirmToken` => success
  - token reuse => `INVALID_CONFIRM_TOKEN`
- Persistence:
  - one user message + one assistant message persisted per chat turn
  - mutation tools create corresponding row(s) in `tool_audit_logs`

## 5) Rollback plan

- If runtime breaks after migration:
  - keep app on previous release image if possible
  - inspect migration state and DB logs
  - disable DB persistence path via environment gating only if emergency procedure exists
  - open incident with failing request IDs from logs

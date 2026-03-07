# Step 1 Security Baseline

This step enforces baseline security invariants:

- No secret leakage from API responses.
- Server-only env validation for critical secrets.
- Baseline auth/rate-limit guards for chat send endpoint.
- Consistent JSON error shape.

Out of scope for this step:

- Full tool execution engine (RBAC/audit/confirm token end-to-end).
- Owner mode destructive flow.
- Notifications/share/export policy hardening.

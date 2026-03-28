# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # start dev server (next dev)
npm run build            # prisma generate + next build
npm run typecheck        # tsc --noEmit --skipLibCheck

# Testing
npm test                 # vitest run (CI subset: smoke + api + security)
npm run test:watch       # vitest interactive
npx vitest run tests/api/chat-routing.test.ts   # run a single test file

# Linting / formatting
npm run lint             # eslint
npm run lint:fix         # eslint --fix
npm run format           # prettier --write
npm run format:check     # prettier --check

# Database
npm run db:push          # prisma db push (no migrations, dev only)
npm run db:migrate       # prisma migrate dev
```

**CI env requirements** — the CI workflow sets `NODE_ENV=test`, `AI_PROVIDER=mock`, `HUSKY=0`. Locally, these must be set the same way when running tests; see `.github/workflows/ci.yml`.

**Vitest scope** — `vitest.config.ts` includes only `tests/smoke.test.ts`, `tests/api/**`, `tests/security/**`. Tests under `tests/` root (e.g. `profile-*.test.ts`) are excluded from `npm test`; run them explicitly if needed.

**Auth mock** — in test mode `@/lib/auth` is aliased to `tests/__mocks__/auth.ts`. Route handlers accept `x-user-id`, `x-user-role`, `x-owner-mode-enabled` headers instead of JWT cookies.

## Architecture

### Request flow: chat send

`POST /api/chat/send` is the core endpoint (`src/app/api/chat/send/route.ts`). It:

1. Authenticates via `getAuthUserId()`, rate-limits, validates body with Zod.
2. Calls `chatPersistence.ts` to resolve/create the conversation and build a **ContextPack** (user profile, tracker data, recent messages, geo opt-in).
3. Calls `orchestrate()` from `src/lib/ai/orchestrator/orchestrator.ts` — the **Unified Orchestration Layer (UOL)**.
4. The UOL: detects domain(s), selects relevant agents from `TEAM/`, runs them in parallel (up to 2 rounds), runs the consensus engine, then synthesizes a final markdown response.
5. Executes any tool calls with RBAC + audit log.
6. Persists the chat turn and case state to DB.
7. Streams back SSE events: `agent.thinking` → `message.delta` → `ui.state` → `tool.result` → `message.complete` → `message.suggestions`.

The 30-second global orchestration budget (`ORCHESTRATION_BUDGET_MS`) guards the whole pipeline; failures fall back to `chatFallback.ts`.

### AI / Orchestrator layer (`src/lib/ai/`)

- **`orchestrator/orchestrator.ts`** — entry point; fast-paths (age questions, generic greetings), domain detection, agent selection, parallel round execution, consensus, synthesis.
- **`orchestrator/routing.ts`** — `resolveRoutingCandidates()` picks agents by domain match + active specialist.
- **`orchestrator/agentRoundExecution.ts`** — runs up to 2 parallel rounds of agent completions.
- **`consensus/`** — merges proposals, resolves domain conflicts, deduplicates questions semantically.
- **`context/contextPackBuilder.ts`** — assembles everything the agents need from DB + session.
- **`case/`** — CaseState/CaseStateSnapshot protocol (specialist handoffs, interview flows, checkpoints). Two representations exist: legacy `CaseState` (keyed by `ownerAgentId`) and canonical `CaseStateSnapshot` (keyed by `domainPanels[]`). `case/compat.ts` bridges them.
- **`team/loader.ts`** — loads `AgentProfile[]` from `TEAM/` directory at runtime (cached per warm instance). Each agent has `profile.json` + `prompt.md` + optional `capabilities.md`.
- **`domain/domainDetection.ts`** — heuristic + LLM-based detection of the 6 domains: `general`, `nutrition`, `health`, `training`, `mindfulness`, `inspiration`.
- **`llmFactory.ts`** — creates the Gemini client (`AI_PROVIDER=gemini`) or a mock (`AI_PROVIDER=mock`). `GEMINI_API_KEY` required in production.

### TEAM directory

`TEAM/` (repo root) holds server-only agent profiles in a two-level directory structure:

```
TEAM/<domain-group>/<agent-id>/profile.json   # id, displayName, domainTags, toolsAllowed, ...
                               /prompt.md      # systemPrompt (path referenced in profile.json)
                               /capabilities.md # optional RuntimeCapabilityContract
```

All agents automatically receive `user.setAttribute` and `user.updateProfile` tools regardless of their `toolsAllowed` list.

### Auth split

- `src/lib/auth.config.ts` — edge-safe config (JWT strategy, `authorized` callback, no Prisma). Used by middleware.
- `src/lib/auth.ts` — full auth with Credentials provider + Prisma. Exports `getAuthUserId()`, `getAuthRole()`, `getAuthOwnerMode()`.
- Middleware lives at the Next.js root (`middleware.ts` at project root — not in `src/`). It re-exports `NextAuth(authConfig).auth`.

### Tools / RBAC

Tool calls are LLM-proposed, server-validated. The pipeline:

1. `toolRegistry.ts` — allowed tool names whitelist.
2. `toolExecutor.ts` — Zod validation, RBAC check, audit log write.
3. `tools/rbac.ts` — per-tool role requirements.
4. Destructive tools require `confirmToken` (generated by `confirmTokenService.ts`) and/or `ownerModeEnabled`.

### Database (Prisma 5 + PostgreSQL)

Key models: `User`, `UserProfile`, `UserAttribute` (EAV per domain/key), `Conversation`, `Message`, `CaseState`, `AgentWorkspace`, `ToolAuditLog`, `FileAsset`, `RecommendationArtifact`, `ClinicalEvent`, `ConversationSummary`, `MessageReview`, `ModerationLog`.

**Do not upgrade to Prisma 7** — the adapter breaks Turbopack.

### App routes

Two route groups under `src/app/`:

- `(app)/` — authenticated shell: chat (`page.tsx`), profile dashboards (`profile/[domain]`), artifacts, settings, admin.
- `(auth)/` — unauthenticated: login, register, forgot/reset-password.

### Environment variables

Required in production: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GEMINI_API_KEY`.
Optional tuning: `AI_MODEL` (default `gemini-2.5-flash`), `LIVE_MODEL`, `ORCH_MAX_AGENTS` (1–10), `ORCH_RETRY_GUARD_WINDOW_MS`.
Always required: `AUTH_TRUST_HOST=true` on Vercel.

### Agent workflow (AGENTS.md)

When working on this repo as an AI agent, respond in Italian. Use `ROLE: <nome-ruolo>` to activate a role from `agenti/categories/`. Write `PROCESSO ULTIMATO` only when the entire requested task is complete end-to-end.

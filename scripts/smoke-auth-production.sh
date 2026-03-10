#!/usr/bin/env bash
set -euo pipefail

# Smoke test autenticato E2E su production:
# 1) register/login sessione
# 2) /api/chat/send su 2 turni stessa conversation
# 3) /tool user.setAttribute
# 4) verifica DB (AgentWorkspace + UserAttribute)
# 5) cleanup utente smoke + verifica residui

usage() {
  cat <<'USAGE'
Uso:
  SMOKE_PASSWORD='...' DATABASE_URL='...' ./scripts/smoke-auth-production.sh [opzioni]

Opzioni:
  --base-url <url>       Base URL app (default: https://livewell.mottisi.com)
  --env-file <path>      File env da caricare (es: .env.production.local)
  --keep-data            Non eseguire cleanup finale (debug)
  --timeout <sec>        Timeout per chiamate curl (default: 30)
  --help                 Mostra questo aiuto

Secret richiesti:
  - SMOKE_PASSWORD : password del test user (non hardcodata)
  - DATABASE_URL   : per verifica DB + cleanup (o via --env-file)

Output:
  - Stampa JSON finale con codici HTTP, sessione, verifiche DB e cleanup.
USAGE
}

BASE_URL="https://livewell.mottisi.com"
ENV_FILE=""
KEEP_DATA="0"
CURL_TIMEOUT="30"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --keep-data)
      KEEP_DATA="1"
      shift
      ;;
    --timeout)
      CURL_TIMEOUT="${2:-30}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Argomento non riconosciuto: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file non trovato: $ENV_FILE" >&2
    exit 2
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${SMOKE_PASSWORD:-}" ]]; then
  echo "SMOKE_PASSWORD non impostata" >&2
  exit 2
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL non impostata (o manca --env-file)" >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node non trovato" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TS="$(date +%s)"
EMAIL="smoke_${TS}@example.com"
NAME="Smoke User"
CONV_ID="smokeconv_${TS}"
COOKIE_FILE="/tmp/livewell_smoke_cookie_${TS}.txt"
REG_BODY="/tmp/livewell_reg_${TS}.json"
LOGIN_BODY="/tmp/livewell_login_${TS}.txt"
SESSION_BODY="/tmp/livewell_session_${TS}.json"
CHAT1_BODY="/tmp/livewell_chat1_${TS}.sse"
CHAT2_BODY="/tmp/livewell_chat2_${TS}.sse"
CHAT3_BODY="/tmp/livewell_chat3_${TS}.sse"
SUMMARY_JSON="/tmp/livewell_smoke_summary_${TS}.json"

curl_json_post() {
  local url="$1"
  local body_file="$2"
  local json_payload="$3"
  local code
  code="$(curl -sS --max-time "$CURL_TIMEOUT" -o "$body_file" -w '%{http_code}' -X POST "$url" -H 'content-type: application/json' -c "$COOKIE_FILE" -b "$COOKIE_FILE" --data "$json_payload")"
  printf '%s' "$code"
}

# 1) Register
REG_CODE="$(curl_json_post "$BASE_URL/api/auth/register" "$REG_BODY" "{\"email\":\"$EMAIL\",\"password\":\"$SMOKE_PASSWORD\",\"name\":\"$NAME\"}")"
if [[ "$REG_CODE" != "201" ]]; then
  echo "Register fallito: HTTP $REG_CODE" >&2
  cat "$REG_BODY" >&2 || true
  exit 1
fi

# 2) Login via NextAuth credentials
CSRF_JSON="$(curl -sS --max-time "$CURL_TIMEOUT" -c "$COOKIE_FILE" -b "$COOKIE_FILE" "$BASE_URL/api/auth/csrf")"
CSRF_TOKEN="$(printf '%s' "$CSRF_JSON" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
if [[ -z "$CSRF_TOKEN" ]]; then
  echo "csrfToken non estratto" >&2
  exit 1
fi

LOGIN_CODE="$(curl -sS --max-time "$CURL_TIMEOUT" -o "$LOGIN_BODY" -w '%{http_code}' -L -c "$COOKIE_FILE" -b "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/callback/credentials" -H 'content-type: application/x-www-form-urlencoded' --data "csrfToken=$CSRF_TOKEN&email=$EMAIL&password=$SMOKE_PASSWORD&redirect=false&callbackUrl=$BASE_URL/")"
if [[ "$LOGIN_CODE" != "200" ]]; then
  echo "Login fallito: HTTP $LOGIN_CODE" >&2
  cat "$LOGIN_BODY" >&2 || true
  exit 1
fi

curl -sS --max-time "$CURL_TIMEOUT" -o "$SESSION_BODY" -c "$COOKIE_FILE" -b "$COOKIE_FILE" "$BASE_URL/api/auth/session"
USER_ID="$(node -e 'const fs=require("fs");const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(o?.user?.id||"")' "$SESSION_BODY")"
if [[ -z "$USER_ID" ]]; then
  echo "Sessione non autenticata" >&2
  cat "$SESSION_BODY" >&2 || true
  exit 1
fi

# 3) chat/send x2 + tool user.setAttribute
CHAT1_CODE="$(curl_json_post "$BASE_URL/api/chat/send" "$CHAT1_BODY" "{\"message\":\"ho mal di schiena lombare da 3 giorni\",\"conversationId\":\"$CONV_ID\"}")"
CHAT2_CODE="$(curl_json_post "$BASE_URL/api/chat/send" "$CHAT2_BODY" "{\"message\":\"il dolore aumenta quando mi piego in avanti\",\"conversationId\":\"$CONV_ID\"}")"
CHAT3_CODE="$(curl_json_post "$BASE_URL/api/chat/send" "$CHAT3_BODY" "{\"message\":\"/tool user.setAttribute {\\\"domain\\\":\\\"health\\\",\\\"key\\\":\\\"diagnosis\\\",\\\"value\\\":\\\"lombalgia smoke\\\",\\\"notes\\\":\\\"smoke prod e2e\\\"}\",\"conversationId\":\"$CONV_ID\"}")"

if [[ "$CHAT1_CODE" != "200" || "$CHAT2_CODE" != "200" || "$CHAT3_CODE" != "200" ]]; then
  echo "Uno o più chat/send hanno fallito: $CHAT1_CODE $CHAT2_CODE $CHAT3_CODE" >&2
  exit 1
fi

# Verifica SSE minima
if ! grep -q '"type":"message.complete"' "$CHAT1_BODY"; then
  echo "CHAT1 senza message.complete" >&2
  exit 1
fi
if ! grep -q '"type":"message.complete"' "$CHAT2_BODY"; then
  echo "CHAT2 senza message.complete" >&2
  exit 1
fi
if ! grep -q '"type":"tool.result"' "$CHAT3_BODY"; then
  echo "CHAT3 senza tool.result" >&2
  exit 1
fi
if ! grep -q '"ok":true' "$CHAT3_BODY"; then
  echo "CHAT3 tool.result non OK" >&2
  exit 1
fi

# 4) Query DB verifica
DB_VERIFY_JSON="$(cd "$PROJECT_ROOT" && DATABASE_URL="$DATABASE_URL" node - <<'NODE' "$CONV_ID" "$USER_ID"
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const conversationId = process.argv[2]
const userId = process.argv[3]

async function main() {
  const workspaces = await prisma.agentWorkspace.findMany({
    where: { conversationId },
    select: { agentId: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const diagnosisAttrs = await prisma.userAttribute.findMany({
    where: { userId, conversationId, key: 'diagnosis' },
    select: { key: true, value: true, notes: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const updatedRows = workspaces.filter((w) => new Date(w.updatedAt) > new Date(w.createdAt)).length

  console.log(JSON.stringify({
    workspaceCount: workspaces.length,
    updatedRows,
    workspaces,
    diagnosisAttrs,
  }))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
NODE
)"

# 5) Cleanup
CLEANUP_JSON='{"skipped":true}'
if [[ "$KEEP_DATA" == "0" ]]; then
  CLEANUP_JSON="$(cd "$PROJECT_ROOT" && DATABASE_URL="$DATABASE_URL" node - <<'NODE' "$EMAIL" "$CONV_ID" "$USER_ID"
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const email = process.argv[2]
const conversationId = process.argv[3]
const userId = process.argv[4]

async function main() {
  const deleted = await prisma.user.deleteMany({ where: { email } })
  const [workspaceRowsAfterCleanup, attributesRowsAfterCleanup] = await Promise.all([
    prisma.agentWorkspace.count({ where: { conversationId } }),
    prisma.userAttribute.count({ where: { userId, conversationId } }),
  ])

  console.log(JSON.stringify({
    deletedUsers: deleted.count,
    workspaceRowsAfterCleanup,
    attributesRowsAfterCleanup,
  }))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
NODE
)"
fi

node - <<'NODE' "$SUMMARY_JSON" "$BASE_URL" "$EMAIL" "$CONV_ID" "$USER_ID" "$REG_CODE" "$LOGIN_CODE" "$CHAT1_CODE" "$CHAT2_CODE" "$CHAT3_CODE" "$DB_VERIFY_JSON" "$CLEANUP_JSON" "$CHAT1_BODY" "$CHAT2_BODY" "$CHAT3_BODY"
const fs = require('fs')
const [
  summaryPath,
  baseUrl,
  email,
  convId,
  userId,
  reg,
  login,
  c1,
  c2,
  c3,
  verifyRaw,
  cleanupRaw,
  chat1Body,
  chat2Body,
  chat3Body,
] = process.argv.slice(2)

const summary = {
  baseUrl,
  email,
  conversationId: convId,
  userId,
  http: {
    register: Number(reg),
    login: Number(login),
    chat1: Number(c1),
    chat2: Number(c2),
    chat3: Number(c3),
  },
  dbVerification: JSON.parse(verifyRaw),
  cleanup: JSON.parse(cleanupRaw),
  evidenceFiles: {
    chat1Body,
    chat2Body,
    chat3Body,
  },
}

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
NODE

echo "SMOKE_SUMMARY_PATH=$SUMMARY_JSON"

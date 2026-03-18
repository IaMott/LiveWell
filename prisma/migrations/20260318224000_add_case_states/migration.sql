CREATE TABLE "case_states" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "owner_agent_id" TEXT NOT NULL,
  "active_speaker_agent_id" TEXT NOT NULL,
  "protocol_state" TEXT NOT NULL,
  "consult_target_agent_id" TEXT,
  "return_target_agent_id" TEXT,
  "consult_reason" TEXT,
  "pending_handoff_agent_id" TEXT,
  "checkpoint_reason" TEXT,
  "takeover_turns" INTEGER NOT NULL DEFAULT 0,
  "loop_count" INTEGER NOT NULL DEFAULT 0,
  "handoff_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "case_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "case_states_conversation_id_key" ON "case_states"("conversation_id");
CREATE INDEX "case_states_user_id_updated_at_idx" ON "case_states"("user_id", "updated_at");

ALTER TABLE "case_states"
ADD CONSTRAINT "case_states_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_states"
ADD CONSTRAINT "case_states_conversation_id_fkey"
FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "messages_conversation_id_idx";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_min" INTEGER,
    "specialist" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "repeat" TEXT DEFAULT 'none',
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_performance_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "proposal_hash" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "user_feedback" INTEGER,
    "was_selected" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_performance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_summaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'general',
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feedbacks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "request_id" TEXT NOT NULL,
    "flag_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "excerpt" TEXT,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_user_id_scheduled_at_idx" ON "appointments"("user_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "appointments_user_id_status_idx" ON "appointments"("user_id", "status");

-- CreateIndex
CREATE INDEX "reminders_user_id_remind_at_idx" ON "reminders"("user_id", "remind_at");

-- CreateIndex
CREATE INDEX "reminders_sent_remind_at_idx" ON "reminders"("sent", "remind_at");

-- CreateIndex
CREATE INDEX "agent_performance_logs_agent_id_created_at_idx" ON "agent_performance_logs"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_performance_logs_user_id_created_at_idx" ON "agent_performance_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_performance_logs_conversation_id_idx" ON "agent_performance_logs"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_summaries_conversation_id_key" ON "conversation_summaries"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_summaries_user_id_updated_at_idx" ON "conversation_summaries"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "user_feedbacks_user_id_created_at_idx" ON "user_feedbacks"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_feedbacks_conversation_id_idx" ON "user_feedbacks"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_feedbacks_user_id_request_id_key" ON "user_feedbacks"("user_id", "request_id");

-- CreateIndex
CREATE INDEX "moderation_logs_user_id_created_at_idx" ON "moderation_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_logs_flag_type_created_at_idx" ON "moderation_logs"("flag_type", "created_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_deleted_at_idx" ON "messages"("conversation_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

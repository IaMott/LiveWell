-- CreateTable
CREATE TABLE "user_attributes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "source" TEXT NOT NULL DEFAULT 'agent',
    "conversation_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_attributes_user_id_domain_key_recorded_at_idx"
  ON "user_attributes"("user_id", "domain", "key", "recorded_at");

-- CreateIndex
CREATE INDEX "user_attributes_user_id_key_recorded_at_idx"
  ON "user_attributes"("user_id", "key", "recorded_at");

-- AddForeignKey
ALTER TABLE "user_attributes"
  ADD CONSTRAINT "user_attributes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

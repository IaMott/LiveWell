-- AddColumn domain and specialist_name to messages table
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "domain" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "specialist_name" TEXT;

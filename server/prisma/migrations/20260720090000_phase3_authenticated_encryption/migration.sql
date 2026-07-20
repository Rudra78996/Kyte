-- Existing secrets used either the removed fallback AES-CBC key or Base64.
-- This small installation intentionally requires users to reconnect/re-enter
-- them instead of retaining unauthenticated legacy ciphertext.
-- EnvironmentVariable was added with `db push` in early development and is
-- absent from the historical migrations, so create its legacy shape first
-- when replaying the migrations against a clean database.
CREATE TABLE IF NOT EXISTS "EnvironmentVariable" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnvironmentVariable_pkey" PRIMARY KEY ("id")
);

-- Notification was introduced through the same early `db push` workflow.
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DELETE FROM "EnvironmentVariable";
DELETE FROM "GitHubConnection";
UPDATE "Project" SET "webhookId" = NULL;

ALTER TABLE "EnvironmentVariable"
ADD COLUMN "authTag" TEXT NOT NULL;

ALTER TABLE "GitHubConnection"
ADD COLUMN "tokenIv" TEXT,
ADD COLUMN "tokenAuthTag" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "EnvironmentVariable_projectId_key_key"
ON "EnvironmentVariable"("projectId", "key");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'EnvironmentVariable_projectId_fkey'
    ) THEN
        ALTER TABLE "EnvironmentVariable"
        ADD CONSTRAINT "EnvironmentVariable_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Notification_userId_fkey'
    ) THEN
        ALTER TABLE "Notification"
        ADD CONSTRAINT "Notification_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

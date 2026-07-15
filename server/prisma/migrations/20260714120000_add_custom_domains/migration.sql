-- CreateTable
CREATE TABLE IF NOT EXISTS "CustomDomain" (
    "id" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomDomain_domainName_key" ON "CustomDomain"("domainName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomDomain_projectId_idx" ON "CustomDomain"("projectId");

-- Add the column when upgrading databases that already had an early custom-domain table.
ALTER TABLE "CustomDomain" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CustomDomain_projectId_fkey'
    ) THEN
        ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

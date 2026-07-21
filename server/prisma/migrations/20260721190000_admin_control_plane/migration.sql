CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "projectLimitOverride" INTEGER;

CREATE TABLE "PlatformSettings" (
  "id" TEXT NOT NULL,
  "deploymentsPaused" BOOLEAN NOT NULL DEFAULT false,
  "defaultProjectLimit" INTEGER NOT NULL DEFAULT 4,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "deploymentsPaused", "defaultProjectLimit", "updatedAt")
VALUES ('platform', false, 4, NOW());

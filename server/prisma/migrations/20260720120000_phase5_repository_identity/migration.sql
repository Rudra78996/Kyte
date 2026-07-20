ALTER TABLE "Project"
ADD COLUMN "githubRepositoryId" TEXT;

CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

ALTER TABLE "OrganizationMember"
ALTER COLUMN "role" DROP DEFAULT,
ALTER COLUMN "role" TYPE "OrganizationRole"
USING ("role"::"OrganizationRole"),
ALTER COLUMN "role" SET DEFAULT 'MEMBER';

CREATE INDEX "Project_githubRepositoryId_branch_idx"
ON "Project"("githubRepositoryId", "branch");

/*
  Warnings:

  - Added the required column `deployedBy` to the `Deployment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `repoUrl` to the `Deployment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "commitMessage" TEXT,
ADD COLUMN     "deployedBy" TEXT NOT NULL,
ADD COLUMN     "repoUrl" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "description" TEXT;

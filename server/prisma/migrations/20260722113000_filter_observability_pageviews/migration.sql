-- Existing request logs were collected before bot, asset, probe, and preview
-- filtering existed. Keep them for operational history but exclude them from
-- visitor analytics by default.
ALTER TABLE "RequestLog"
ADD COLUMN "isPageView" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "RequestLog_projectId_isPageView_timestamp_idx"
ON "RequestLog"("projectId", "isPageView", "timestamp");

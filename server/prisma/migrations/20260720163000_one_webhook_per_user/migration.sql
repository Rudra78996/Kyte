DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Project"
    WHERE "webhookId" IS NOT NULL
    GROUP BY "userId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce one enabled webhook per user while duplicate enabled hooks exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX "Project_one_enabled_webhook_per_user_key"
ON "Project"("userId")
WHERE "webhookId" IS NOT NULL;

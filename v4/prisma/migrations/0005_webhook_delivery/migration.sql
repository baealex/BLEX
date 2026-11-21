CREATE TABLE "blex_webhook_delivery" (
  "post_id" INTEGER NOT NULL REFERENCES "board_post" ("id") ON DELETE CASCADE,
  "channel_id" INTEGER NOT NULL REFERENCES "board_webhooksubscription" ("id") ON DELETE CASCADE,
  "available_at" BIGINT NOT NULL,
  "done" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("post_id", "channel_id")
);

CREATE INDEX "blex_webhook_delivery_pending_idx" ON "blex_webhook_delivery" ("done", "available_at");

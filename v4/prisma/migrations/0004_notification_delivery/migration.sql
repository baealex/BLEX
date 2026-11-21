CREATE TABLE "blex_notification_delivery" (
  "notification_id" INTEGER NOT NULL PRIMARY KEY REFERENCES "board_notify" ("id") ON DELETE CASCADE,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" BIGINT NOT NULL
);

CREATE INDEX "blex_notification_delivery_available_at_idx" ON "blex_notification_delivery" ("available_at");

CREATE TABLE "blex_scheduled_publication" (
  "post_id" INTEGER NOT NULL PRIMARY KEY REFERENCES "board_post" ("id") ON DELETE CASCADE,
  "publish_at" TEXT NOT NULL
);

CREATE INDEX "blex_scheduled_publication_publish_at_idx" ON "blex_scheduled_publication" ("publish_at");

INSERT INTO "blex_scheduled_publication" ("post_id", "publish_at")
SELECT id, CAST(published_date AS TEXT) FROM board_post
WHERE deleted_date IS NULL AND published_date > strftime('%Y-%m-%d %H:%M:%f', 'now');

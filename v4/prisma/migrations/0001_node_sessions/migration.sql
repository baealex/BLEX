CREATE TABLE "blex_session" (
  "token_hash" TEXT NOT NULL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "credential_tag" TEXT NOT NULL,
  "expires_at" BIGINT NOT NULL
);

CREATE INDEX "blex_session_user_id_idx" ON "blex_session" ("user_id");
CREATE INDEX "blex_session_expires_at_idx" ON "blex_session" ("expires_at");

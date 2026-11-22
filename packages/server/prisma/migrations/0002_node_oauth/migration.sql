CREATE TABLE "blex_oauth_flow" (
  "state_hash" TEXT NOT NULL PRIMARY KEY,
  "browser_hash" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "verifier" TEXT NOT NULL,
  "return_path" TEXT NOT NULL,
  "expires_at" BIGINT NOT NULL
);

CREATE INDEX "blex_oauth_flow_expires_at_idx" ON "blex_oauth_flow" ("expires_at");

CREATE TABLE "blex_oauth_challenge" (
  "token_hash" TEXT NOT NULL PRIMARY KEY,
  "social_auth_id" INTEGER NOT NULL REFERENCES "board_socialauth" ("id") ON DELETE CASCADE,
  "return_path" TEXT NOT NULL,
  "expires_at" BIGINT NOT NULL
);

CREATE INDEX "blex_oauth_challenge_social_auth_id_idx" ON "blex_oauth_challenge" ("social_auth_id");
CREATE INDEX "blex_oauth_challenge_expires_at_idx" ON "blex_oauth_challenge" ("expires_at");

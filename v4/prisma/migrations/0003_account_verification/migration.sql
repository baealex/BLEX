ALTER TABLE "blex_session" ADD COLUMN "verified_until" BIGINT;
ALTER TABLE "blex_session" ADD COLUMN "verified_factor_id" INTEGER;
ALTER TABLE "blex_session" ADD COLUMN "requires_factor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "blex_oauth_flow" ADD COLUMN "session_hash" TEXT;
ALTER TABLE "blex_oauth_flow" ADD COLUMN "language" TEXT NOT NULL DEFAULT '';
ALTER TABLE "blex_oauth_flow" ADD COLUMN "time_zone" TEXT NOT NULL DEFAULT '';

CREATE TABLE "blex_factor_setup" (
  "session_hash" TEXT NOT NULL PRIMARY KEY REFERENCES "blex_session" ("token_hash") ON DELETE CASCADE ON UPDATE CASCADE,
  "secret" TEXT NOT NULL,
  "recovery_hash" TEXT NOT NULL,
  "expires_at" BIGINT NOT NULL
);

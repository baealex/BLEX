# Upgrade from BLEX 3.14 to 4

For new installations and routine operations, use the [self-hosting guide](SELF_HOSTING.md). This guide explains how to migrate an existing SQLite database, media files, and accounts to BLEX 4. The previous code and documentation are available at the `v3.14` Git tag.

## Preparation

- The final Django migration in 3.14 is `0070_author_subscription`. Upgrade older installations to this schema before migrating to BLEX 4.
- Existing password hashes and social account links are preserved. Users must sign in again after the upgrade.
- Preserve `CIPHER_KEY`, `SECRET_KEY`, and `SITE_URL`. Changing `CIPHER_KEY` prevents BLEX from reading stored social login and two-factor authentication secrets.

Build the migration image from the repository root.

```sh
docker build --target migration -t blex4-migration .
export BLEX_DATA=/absolute/path/to/blex4-data
mkdir -p "$BLEX_DATA/media"
```

## Move the database and media

1. Stop the existing service and back up the SQLite database, media, and environment file. Use the SQLite CLI's `.backup` command or a consistent snapshot. Keep the originals and place working copies at `$BLEX_DATA/db.sqlite3` and `$BLEX_DATA/media/`.
2. Apply the remaining 3.14 migrations to the database copy.

   ```sh
   docker run --rm --env-file /absolute/path/to/blex3.env \
     --mount "type=bind,source=$BLEX_DATA/db.sqlite3,target=/app/db.sqlite3" \
     --mount "type=bind,source=$BLEX_DATA/media,target=/app/resources/media" \
     --entrypoint python baealex/blex:3.14 manage.py migrate --noinput
   ```

3. Set ownership so the BLEX 4 container's `node` user (Linux UID 1000) can read from and write to the copied data directory, database, and media files. SQLite must be able to create journal files, and media subdirectories must also be writable.
4. Verify the schema, SQLite integrity, and foreign keys. Register the Prisma baseline, then apply the BLEX 4 migrations.

   ```sh
   docker run --rm --user 1000:1000 \
     --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
     -e DATABASE_URL=file:/var/lib/blex/db.sqlite3 blex4-migration sh -ec '
       node dist/src/compat/database-baseline.js /var/lib/blex/db.sqlite3 &&
       node node_modules/prisma/build/index.js migrate resolve --applied 0000_django_3x &&
       node node_modules/prisma/build/index.js migrate deploy'
   ```

   Register the baseline only once per database. If `migrate resolve` succeeded, retry from `migrate deploy`. Later BLEX 4 upgrades use `migrate deploy` without repeating the baseline verification.

## Configure and start Compose

Copy your existing configuration from `backend/.env` to `.env` at the repository root, then update the following settings.

| Setting | Change |
| --- | --- |
| `BLEX_DATA` | Absolute path to the migrated data directory |
| `BLEX_PORT_MAPPING` | Change the container port from `80` to `8040`, for example `127.0.0.1:20002:8040` |
| `BLEX_TRUSTED_PROXIES` | HTTPS proxy IP addresses or CIDR ranges. BLEX also reads the previous `TRUSTED_PROXY_IPS` setting as a fallback |
| `SITE_URL`, `SECRET_KEY`, `CIPHER_KEY` | Preserve the existing values |

```sh
docker compose up --build -d
docker compose logs blex
```

Compose's preflight checks prevent startup if the container port mapping is incorrect, an existing database has not been copied into the new data directory, or media directories are not writable.

Check that existing post and media URLs still work. Test password login, social login, two-factor authentication, saving posts, and the admin settings. To restore the previous version, first decide how to handle changes made after the switch, then restore the pre-upgrade database and media backups together.

## Preview public pages from a backup

Before switching to BLEX 4, preview public pages using a read-only copy of the database. Run from the repository root.

```sh
pnpm install
pnpm build
BLEX_V4_READ_ONLY=1 BLEX_V4_DB_PATH=/absolute/path/to/db.sqlite3 \
  BLEX_V4_MEDIA_PATH=/absolute/path/to/media pnpm start
```

Open `http://localhost:8040`. Signing in and editing are disabled in this mode.

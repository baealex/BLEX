# Self-hosting BLEX

BLEX 4 serves the blog, admin pages, and APIs from one Node.js process. The server applies Prisma migrations to its data directory when it starts.

## New installation

Create a `.env` file at the repository root.

| Setting | Value |
| --- | --- |
| `SITE_URL` | Base URL visitors use (scheme, hostname, and port). Local example: `http://localhost:20002`; production example: `https://blog.example.com` |
| `SECRET_KEY` | A random value generated with `openssl rand -hex 32` |
| `CIPHER_KEY` | A 32-byte ASCII value generated with `openssl rand -hex 16` |
| `INITIAL_SETUP_TOKEN` | Optional. When left empty, BLEX generates a token at startup and includes it in the setup URL |
| `BLEX_DATA` | Optional. Compose uses the `blex-data` named volume by default. Use an absolute path for a host directory |
| `BLEX_PORT_MAPPING` | Optional. Defaults to `127.0.0.1:20002:8040` |
| `BLEX_TRUSTED_PROXIES` | Required behind an HTTPS proxy. Comma-separated IP addresses or CIDR ranges of proxies that connect directly to BLEX |
| `DEVELOPER_API_MAX_UPLOAD_MB` | Optional. Upload size limit for post images and videos; defaults to 20 MB |
| `TZ` | Optional. Local time zone |
| `BLEX_DEFAULT_LANGUAGE` | Optional. Default UI language for visitors without a saved preference; defaults to `ko`. To use `en`, also set `ENABLE_ENGLISH_UI=TRUE`. Authored content remains in its original language; see [Translation Guide](TRANSLATION_GUIDE.md) |

```sh
docker compose up --build -d
docker compose logs blex
```

Follow the `/setup` URL in the logs to create the first administrator account. Use the admin settings to configure the site name and other site settings. See [Social Login Setup](SOCIAL_LOGIN.md) to connect Google or GitHub.

## HTTPS reverse proxy

For public deployments, use a reverse proxy such as nginx or Caddy to handle HTTPS and forward requests to BLEX's HTTP port. Set `SITE_URL` to the public HTTPS base URL. BLEX uses it for canonical URLs, share links, OAuth callbacks, RSS, and sitemaps.

A proxy on the same host can use the default port mapping at `127.0.0.1:20002`. Configure the proxy to forward the original client IP address and request protocol. Set `BLEX_TRUSTED_PROXIES` to the proxy IP addresses seen by BLEX. Without this setting, all visitors behind the proxy share a login rate limit: five failed attempts can block everyone from logging in for five minutes. Match the proxy's request-body limit to the upload limit.

## Backups

The data volume contains `db.sqlite3` and `media/`. Back up the database and media together so they represent the same point in time. Keep a copy of the environment file as well. While the database is in use, use SQLite's backup API or a consistent snapshot.

Work-log attachments are stored under `media/_work_logs/`. BLEX checks ownership or sharing permissions before serving them. Exclude this directory from public paths if you add a separate static file server.

## Run containers directly

To run the container without Compose, build the image from the repository root.

```sh
docker build -t blex4 .
export BLEX_DATA=/absolute/path/to/blex4-data
mkdir -p "$BLEX_DATA/media"
```

Set ownership so the container's `node` user (Linux UID 1000) can read from and write to the data directory and all media subdirectories. SQLite also writes journal files in the data directory.

Start the service with an environment file containing the settings above. BLEX creates or migrates the database before it starts serving.

```sh
docker run --rm --env-file /absolute/path/to/blex.env \
  --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
  -p 127.0.0.1:20002:8040 blex4
```

For later updates, start the new image with the same data directory. The runtime image includes FFmpeg and the compiled assets for both frontend builds.

## Upgrade an existing installation

[Upgrade from BLEX 3.14 to 4](UPGRADE_FROM_3.md) covers the one-time data import, the Compose changes, and how to roll back.

### Update between 4.x releases

Stop BLEX and back up the data volume before you start a new release. BLEX applies the release's migrations when it starts, so keep that backup until you no longer need to go back.

### Roll back to an earlier 4.x release

Migrations only add to the schema, so an earlier image starts on a migrated database. Data written by the newer release can still mean something different to the older one, so the safest rollback is to restore the backup taken before the update. You lose what was written since.

To keep newer data instead, follow the note below for every release you roll back past before you start the earlier image.

- **4.2 to 4.1:** BLEX 4.2 keeps the author of a deleted comment and marks the comment with `deletedAt`. BLEX 4.1 does not read that column, so it would show those comments again with their author and text. Stop BLEX, back up `db.sqlite3`, and run this before you start 4.1:

  ```sql
  UPDATE Comment SET authorId = NULL WHERE deletedAt IS NOT NULL AND authorId IS NOT NULL;
  ```

  `SELECT COUNT(*) FROM Comment WHERE deletedAt IS NOT NULL AND authorId IS NOT NULL;` must then return 0. The column and its migration record can stay, and updating to 4.2 again does not reapply the migration. The authors of those deleted comments are not kept.

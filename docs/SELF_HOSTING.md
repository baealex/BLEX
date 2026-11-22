# Self-hosting BLEX

BLEX 4 serves the blog, admin pages, and APIs from one Node.js process. Docker Compose applies Prisma migrations to the shared data volume before starting the application.

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

```sh
docker compose up --build -d
docker compose logs blex
```

Follow the `/setup` URL in the logs to create the first administrator account. Use the admin settings to configure the site name, login options, and other site settings.

## HTTPS reverse proxy

For public deployments, use a reverse proxy such as nginx or Caddy to handle HTTPS and forward requests to BLEX's HTTP port. Set `SITE_URL` to the public HTTPS base URL. BLEX uses it for canonical URLs, share links, OAuth callbacks, RSS, and sitemaps.

A proxy on the same host can use the default port mapping at `127.0.0.1:20002`. Configure the proxy to forward the original client IP address and request protocol. Set `BLEX_TRUSTED_PROXIES` to the proxy IP addresses seen by BLEX. Without this setting, all visitors behind the proxy share a login rate limit: five failed attempts can block everyone from logging in for five minutes. Match the proxy's request-body limit to the upload limit.

## Backups

The data volume contains `db.sqlite3` and `media/`. Back up the database and media together so they represent the same point in time. Keep a copy of the environment file as well. While the database is in use, use SQLite's backup API or a consistent snapshot. Work-log attachments are stored under `media/_work_logs/`. BLEX checks ownership or sharing permissions before serving them. Exclude this directory from public paths if you add a separate static file server.

## Run containers directly

To run containers without Compose, build both images from the repository root.

```sh
docker build --target migration -t blex4-migration .
docker build -t blex4 .
export BLEX_DATA=/absolute/path/to/blex4-data
mkdir -p "$BLEX_DATA/media"
```

Set ownership so the container's `node` user (Linux UID 1000) can read from and write to the data directory and all media subdirectories. SQLite also writes journal files in the data directory.

Apply the schema to an empty data directory, then start the service with an environment file containing the settings above.

```sh
docker run --rm --user 1000:1000 \
  --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
  -e DATABASE_URL=file:/var/lib/blex/db.sqlite3 blex4-migration
docker run --rm --env-file /absolute/path/to/blex.env \
  --mount "type=bind,source=$BLEX_DATA,target=/var/lib/blex" \
  -p 127.0.0.1:20002:8040 blex4
```

For later updates, apply migrations to the same data directory before starting the service. The runtime image includes FFmpeg and the compiled assets for both frontend builds.

## Upgrade an existing installation

[Upgrade from BLEX 3.14 to 4](UPGRADE_FROM_3.md) covers registering the database baseline, updating environment settings and ports, and verifying the upgrade.

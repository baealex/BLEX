# Upgrade from BLEX 3.14 to 4

BLEX 4 imports a 3.14 installation once, the first time it starts. The original database and media are mounted read-only and stay unchanged. For new installations and routine operations, use the [self-hosting guide](SELF_HOSTING.md).

## Before you start

- **Reach 3.14 first.** BLEX 4 only imports the final 3.14 schema. If you run an older 3.x version, set the image to `baealex/blex:3.14`, start it once so it applies its migrations, and stop it.
- **Back up** the SQLite database, media, and environment file.
- **Keep `SECRET_KEY`, `CIPHER_KEY`, and `SITE_URL`.** Changing `CIPHER_KEY` prevents BLEX from reading stored social login and two-factor authentication secrets.
- Password hashes and social account links are preserved. Everyone signs in again after the upgrade.

## Upgrade with Compose

1. Stop BLEX 3.x.

   ```sh
   docker compose down
   ```

2. Change the `blex` service in `docker-compose.yml`. BLEX 4 listens on port 8040 and keeps its data in a volume of its own, with the 3.x folder mounted read-only at `/legacy`.

   ```yaml
   services:
     blex:
       image: baealex/blex:4
       env_file: ./backend/.env
       restart: unless-stopped
       ports:
         - "127.0.0.1:20002:8040"
       volumes:
         - blex-data:/var/lib/blex
         - ./backend/src:/legacy:ro

   volumes:
     blex-data:
   ```

3. If your environment file sets `BLEX_PORT_MAPPING`, change its container port from `80` to `8040`. Behind an HTTPS proxy, set `BLEX_TRUSTED_PROXIES` to the proxy's IP address or CIDR range. BLEX also reads the previous `TRUSTED_PROXY_IPS` setting.

4. If `backend/src/resources/media/_work_logs` exists, let BLEX 4 read it. BLEX 3.14 ran as root and kept work log attachments private, while BLEX 4 runs as user 1000. BLEX 3.14 can still read the folder afterward.

   ```sh
   sudo chown -R 1000:1000 backend/src/resources/media/_work_logs
   ```

5. Start BLEX 4 and read the log.

   ```sh
   docker compose pull
   docker compose up -d
   docker compose logs blex
   ```

   The log reports how many rows were imported. Check that post and media URLs work, then test password login, social login, two-factor authentication, saving a post, and the admin settings.

## What the first start does

1. Checks that `/legacy/db.sqlite3` is an intact 3.14 database.
2. Builds a new database beside the destination and copies your data into it, leaving out the 3.x framework's internal records and old sessions.
3. Copies media into the BLEX 4 data volume.
4. Verifies the result and moves the new database into place.

If any step fails, BLEX removes the unfinished database, reports the reason, and exits. Fix the problem and start it again. Once the import succeeds, later starts use the BLEX 4 database and never read `/legacy` again.

BLEX also stops without changing data if it finds an unchanged 3.x Compose file, a 3.x database in the BLEX 4 data directory, or a port mapping that still points to port 80.

## Roll back

Restore your previous `docker-compose.yml` and start BLEX 3.14. Its database was not changed. Posts, comments, and settings written in BLEX 4 are not carried back.

## Later updates

```sh
docker compose pull
docker compose up -d
```

BLEX applies any new migrations when it starts. You can remove the `/legacy` mount after a successful import.

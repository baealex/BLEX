<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="backend/src/resources/logow.svg">
    <img alt="BLEX" src="backend/src/resources/logob.svg" width="108">
  </picture>
</p>

<h1 align="center">BLEX</h1>

<p align="center">
  A self-hosted blog application for your own domain and server.
</p>

<p align="center">
  <a href="https://github.com/baealex/BLEX/actions/workflows/CI.yml"><img src="https://github.com/baealex/BLEX/actions/workflows/CI.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/Django-6.0-0C4B33?style=flat-square" alt="Django 6.0">
  <img src="https://img.shields.io/badge/React-19-149ECA?style=flat-square" alt="React 19">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  English · <a href="README.ko.md">한국어</a>
</p>

BLEX combines a browser editor and site administration in a single Docker
image. It stores content in SQLite and publishes through the web, RSS,
sitemaps, Markdown, and a Developer API.

## Highlights

- Rich-text writing with drafts, autosave recovery, revision history, previews,
  and scheduled publishing
- Public posts organized by authors, series, tags, search, and static pages
- Administration for branding, users, notices, integrations, social login, and
  TOTP two-factor authentication
- RSS, sitemaps, Open Graph metadata, public Markdown, and scoped API tokens
- English and Korean UI without changing user-authored content

## Quick start

Requirement: Docker.

```bash
docker run -d \
  --name blex \
  --restart unless-stopped \
  -p 20002:80 \
  --mount source=blex-db,target=/var/lib/blex \
  --mount source=blex-media,target=/app/resources/media \
  -e BLEX_SQLITE_DB_PATH=/var/lib/blex/db.sqlite3 \
  -e SECRET_KEY=local-preview-only-change-me \
  -e CIPHER_KEY=local-only-cipher-key-32-charsxx \
  -e DEBUG=TRUE \
  -e ENABLE_ENGLISH_UI=TRUE \
  -e SITE_URL=http://localhost:20002 \
  baealex/blex:latest

docker logs blex
```

Open `http://localhost:20002`. The logs include an `Initial setup URL` for
creating the first administrator. The `blex-db` and `blex-media` volumes keep
the database and uploads when the container is replaced.

This command is for a local trial. Before a public deployment, use unique
secrets, set `DEBUG=FALSE`, configure the public origin and HTTPS, and back up
both volumes. See the [Self-hosting Guide](docs/SELF_HOSTING.md).

## Development

Requirements:

- Python 3.12+
- Node.js 22 (22.22.2+), 24 (24.15+), or 26+
- npm

```bash
npm install
npm run server:migrate
npm run dev
```

Open `http://localhost:8000`.

## Documentation

- [Self-hosting Guide](docs/SELF_HOSTING.md)
- [Development Convention](docs/DEV_CONVENTION.md)
- [Translation Guide](docs/TRANSLATION_GUIDE.md)

## License

[MIT License](LICENSE)

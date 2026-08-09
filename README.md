<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="backend/src/resources/logow.svg">
    <img alt="BLEX" src="backend/src/resources/logob.svg" width="108">
  </picture>
</p>

<h1 align="center">BLEX</h1>

<p align="center">
  An open-source platform for writing, publishing, and running a blog.
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

BLEX is built around one workflow: write, organize, publish, and maintain a
blog over time. It provides a browser editor and administration tools, with
Docker as the supported deployment path.

## Project focus

- **Writing and publishing:** rich-text editing, drafts, autosave recovery,
  revision history, previews, cover images, and scheduled publishing
- **Content management:** authors, series, tags, search, static pages, comments,
  likes, and pinned posts
- **Blog operations:** branding, notices and banners, users and roles, webhooks,
  and Telegram integration
- **Open publishing:** RSS, sitemaps, canonical and Open Graph metadata, public
  Markdown, and a Developer API with scoped tokens

GitHub and Google login, TOTP two-factor authentication, and English and Korean
product UI are included. User-authored content is always displayed as written.

## Run locally with Docker

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

The command uses `DEBUG=TRUE` so BLEX works over local HTTP. This is a
development setting and must not be carried into a public deployment.

Open `http://localhost:20002`, then use the `Initial setup URL` from
`docker logs blex` to create the first administrator. The `blex-db` and
`blex-media` volumes keep the database and uploads when the container is
replaced.

### Production deployment

Use unique secrets, set `DEBUG=FALSE`, and configure `SITE_URL`,
`ALLOWED_HOSTS`, and `CSRF_TRUSTED_ORIGINS` for the public domain. Place an
HTTPS proxy in front of BLEX and back up both volumes. The
[Self-hosting Guide](docs/SELF_HOSTING.md) covers the complete setup and upgrade
path.

## Publishing interfaces

| Path | Purpose |
| --- | --- |
| `/rss` | RSS feed |
| `/sitemap.xml` | Sitemap index |
| `/llms.txt` | Optional agent entry point |
| `/@{username}/{post_url}.md` | Public post as Markdown |
| `/api/developer/v1/docs` | Developer API documentation |

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

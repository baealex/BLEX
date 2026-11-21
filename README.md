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
  <img src="https://img.shields.io/badge/Node.js-24-339933?style=flat-square" alt="Node.js 24">
  <img src="https://img.shields.io/badge/React-19-149ECA?style=flat-square" alt="React 19">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
</p>

<p align="center">
  English · <a href="README.ko.md">한국어</a>
</p>

BLEX is built around one workflow: write, organize, publish, and maintain a
blog over time. A TypeScript server uses Fastify, React SSR, Prisma, and SQLite
to serve the blog, editor, and administration tools in one application.

## Project focus

- **Writing and publishing:** visual and Markdown editing, previews, drafts, autosave recovery,
  revision history, previews, cover images, and scheduled publishing
- **Content management:** authors, series, tags, search, static pages, comments,
  likes, and pinned posts
- **Blog operations:** branding, notices and banners, users and roles, webhooks,
  and Telegram integration
- **Open publishing:** RSS, sitemaps, canonical and Open Graph metadata, public
  Markdown, and a Developer API with scoped tokens

GitHub and Google login and TOTP two-factor authentication are included.

## Run locally with Docker

Create a root `.env` with `SITE_URL=http://localhost:20002`, a random
`SECRET_KEY`, and a 32-byte `CIPHER_KEY`. `openssl rand -hex 16` produces a
32-character ASCII value for `CIPHER_KEY`.

```bash
docker compose up --build -d
docker compose logs blex
```

Open the `/setup` link in the logs to create the first administrator. The
`blex-data` volume keeps the database and uploads between container replacements.

### Production deployment

Use unique secrets and set `SITE_URL` to the public HTTPS origin. Place an
HTTPS proxy in front of the application and back up the data directory.
BLEX 3.x installations use the documented SQLite and media handoff before
starting 4.0. [Self-hosting guide](docs/SELF_HOSTING.md)

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

- Node.js 24 LTS (24.22.1+) or 26 (26.12.1+)
- npm
- FFmpeg for local GIF conversion and video previews

```bash
npm install
npm run dev
```

Open `http://localhost:8040`. The development command initializes a local
SQLite database under `v4/.local/` and prints the first administrator setup link.

## Documentation

- [BLEX 4 installation and upgrade guide](v4/README.md)
- [Development Convention](docs/DEV_CONVENTION.md)
- [Translation Guide](docs/TRANSLATION_GUIDE.md)

## License

[MIT License](LICENSE)

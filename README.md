<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="packages/server/public/logow.svg">
    <img alt="BLEX" src="packages/server/public/logob.svg" width="108">
  </picture>
</p>

<h1 align="center">BLEX</h1>

<p align="center">
  An open-source platform for publishing and managing your own blog.
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

BLEX brings writing, content management, and blog administration into one
application. It uses TypeScript, Fastify, React SSR, Prisma, and SQLite.

## Features

- **Writing and publishing:** visual and Markdown editing, previews, drafts, autosave recovery,
  revision history, cover images, and scheduled publishing
- **Content management:** authors, series, tags, search, static pages, comments,
  likes, and pinned posts
- **Blog operations:** branding, notices and banners, users and roles, webhooks,
  and Telegram integration
- **Feeds, discovery, and APIs:** RSS, sitemaps, canonical URLs, Open Graph
  metadata, Markdown versions of public posts, and a Developer API with scoped access tokens

Authentication options include GitHub and Google sign-in, plus TOTP two-factor authentication.

## Run locally with Docker

Create a `.env` file in the repository root with `SITE_URL=http://localhost:20002`, a random
`SECRET_KEY`, and a 32-byte `CIPHER_KEY`. `openssl rand -hex 16` produces a
32-character ASCII value for `CIPHER_KEY`.

```bash
docker compose up --build -d
docker compose logs blex
```

Follow the `/setup` link in the logs to create the first administrator account.
The `blex-data` volume preserves the database and uploads when containers are replaced.

### Production deployment

Generate new secrets for each installation and set `SITE_URL` to the public
HTTPS base URL. Run the application behind an HTTPS reverse proxy and back up
the data directory. See the [self-hosting guide](docs/SELF_HOSTING.md).

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
- pnpm 11.17.0 (see `package.json`)
- FFmpeg for local GIF conversion and video previews

```bash
pnpm install
pnpm dev
```

Open `http://localhost:8040`. The development command initializes a local
SQLite database under `packages/server/.local/` and prints a setup link for the first administrator account.

## Documentation

- [Installation and operations](docs/SELF_HOSTING.md) · [Social login](docs/SOCIAL_LOGIN.md)
- [Upgrade from BLEX 3.14 to 4](docs/UPGRADE_FROM_3.md)
- [Development conventions](docs/DEV_CONVENTION.md) · [Testing](docs/TESTING_GUIDE.md)
- [Backend](docs/BACKEND_GUIDE.md) · [Frontend](docs/FRONTEND_GUIDE.md) · [Architecture](docs/blex4-architecture.html)
- [Design](docs/DESIGN_GUIDE.md) · [UI changes](docs/UI_CHANGE_STYLE_GUIDE.md)
- [Translation](docs/TRANSLATION_GUIDE.md) · [Dependencies](docs/DEPENDENCY_SECURITY.md)

## License

[MIT License](LICENSE)

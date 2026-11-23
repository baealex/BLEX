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

## Features

- Visual and Markdown editing, drafts, autosave recovery, revision history, and scheduled publishing
- Series, tags, search, static pages, comments, likes, and pinned posts
- Site branding, user roles, webhooks, and Telegram integration
- RSS, sitemaps, public Markdown, and a Developer API
- GitHub and Google login, with TOTP two-factor authentication

## Run with Docker

Create a root `.env` with `SITE_URL=http://localhost:20002`, a random `SECRET_KEY`
(`openssl rand -hex 32`), and a 32-byte `CIPHER_KEY` (`openssl rand -hex 16`).

```sh
docker compose up --build -d
docker compose logs blex
```

Open the `/setup` link in the logs to create the first administrator.
The `blex-data` volume stores the database and uploads.

For HTTPS, backups, and configuration, see the [self-hosting guide](docs/SELF_HOSTING.md).
Existing 3.x installations must follow the [upgrade guide](docs/UPGRADE_FROM_3.md) before starting BLEX 4.

## Development

Use Node.js 24 LTS (24.22.1+) or 26 (26.12.1+) and the pnpm version in `package.json`.

```sh
pnpm install
pnpm dev
```

Open `http://localhost:8040`. Local data is stored in `packages/server/.local/`.
See the [development guide](docs/DEV_CONVENTION.md) for setup, checks, and code guides.

## Documentation

- [Self-hosting](docs/SELF_HOSTING.md)
- [Social login](docs/SOCIAL_LOGIN.md)
- [Upgrade from BLEX 3.14 to 4](docs/UPGRADE_FROM_3.md)
- [Contributing and development](docs/DEV_CONVENTION.md)

## License

[MIT License](LICENSE)

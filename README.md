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

## About

BLEX is a blog application that you run on infrastructure you control. It
provides a browser-based editor, Docker deployment, and the settings needed to
operate a personal blog or a small publication.

Public posts are available as regular web pages as well as RSS, sitemap, and
Markdown endpoints. The default deployment uses SQLite and is configured to
start with modest server resources.

## Features

**Writing and publishing**

- Tiptap-based rich-text editor
- Drafts, autosave recovery, revision history, and previews
- Scheduled publishing and hidden posts
- Cover images, series, and tags
- Markdown or HTML publishing through the Developer API

**Public blog**

- Post, author, series, tag, search, and static pages
- Comments, likes, and pinned posts
- RSS, sitemaps, canonical URLs, and Open Graph metadata
- Public Markdown URLs and optional `/llms.txt`

**Operations**

- Docker-based deployment
- Initial administrator setup
- Site name, logo, and icon settings
- Notices, banners, notifications, webhooks, and Telegram integration
- User roles and administration tools

**Accounts and security**

- GitHub and Google social login
- TOTP two-factor authentication
- Personal Developer API tokens with scoped permissions

**Languages**

- English and Korean product UI
- Request-language negotiation when English UI support is enabled
- Separate translation catalogs for Django, React islands, and the editor
- Posts and other user-authored content are displayed exactly as written

## Run with Docker

Requirements: Git, Docker, and Docker Compose.

```bash
git clone https://github.com/baealex/BLEX.git
cd BLEX
cp samples/.env backend/.env
mkdir -p backend/src/resources/media
touch backend/src/db.sqlite3
docker compose up -d
docker compose logs -f blex
```

Open `http://localhost:20002`. The logs include an `Initial setup URL` for
creating the first administrator.

The sample environment enables English and Korean UI negotiation. Existing
installations can enable it with `ENABLE_ENGLISH_UI=TRUE`.

Before a public deployment, replace the sample secrets, configure the public
site URL and allowed hosts, place an HTTPS proxy in front of BLEX, and back up
both the SQLite database and uploaded media. See the
[Self-hosting Guide](docs/SELF_HOSTING.md) for details.

## Public URLs

| Path | Description |
| --- | --- |
| `/rss` | Site RSS feed |
| `/sitemap.xml` | Sitemap index |
| `/posts/sitemap.xml` | Public post sitemap |
| `/llms.txt` | Agent entry point when AEO is enabled |
| `/@{username}/{post_url}.md` | Public post as Markdown |
| `/@{username}/series/{series_url}.md` | Public series as Markdown |
| `/static/{slug}.md` | Public static page as Markdown |
| `/api/developer/v1/docs` | Developer API documentation |
| `/api/developer/v1/openapi.json` | Developer API OpenAPI schema |

Private posts, hidden posts, drafts, deleted posts, and scheduled posts that
are not yet published are excluded from RSS, sitemaps, and public Markdown
endpoints.

## Developer API

The Developer API supports personal tokens, scoped permissions, post and draft
management, Markdown or HTML input, image upload, publishing, tags, and series.

After starting BLEX, open `/docs/developer-api/quickstart` for the quickstart or
`/api/developer/v1/docs` for the complete API documentation.

## Local development

Requirements:

- Python 3.12+
- Node.js 22.22.2, 24.15+, or 26+
- npm

```bash
npm install
npm run server:migrate
npm run dev
```

Open `http://localhost:8000`.

Common checks:

```bash
npm run server:test
npm run islands:i18n:check
npm run islands:test
npm run islands:lint
npm run islands:type-check
```

## Documentation

- [Self-hosting Guide](docs/SELF_HOSTING.md)
- [Development Convention](docs/DEV_CONVENTION.md)
- [Backend Guide](docs/BACKEND_GUIDE.md)
- [Frontend Guide](docs/FRONTEND_GUIDE.md)
- [Translation Guide](docs/TRANSLATION_GUIDE.md)
- [Testing Guide](docs/TESTING_GUIDE.md)
- [Design Guide](docs/DESIGN_GUIDE.md)

## License

[MIT License](LICENSE)

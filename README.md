<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="backend/src/resources/logow.svg">
    <img alt="BLEX" src="backend/src/resources/logob.svg" width="108">
  </picture>
</p>

<h1 align="center">BLEX</h1>

<p align="center">
  <strong>A self-hosted publishing home for independent developers.</strong><br>
  Write in the browser. Publish from your own domain. Stay readable everywhere.
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

## Your blog should be easy to own and easy to use

You should not have to choose between editing Markdown in a repository and
running a sprawling CMS just to own a blog.

BLEX sits in the middle. Bring a domain and a small server; BLEX gives you a
focused writing desk, a public blog, and the operational tools to keep both
running. Edit and publish without a rebuild, while keeping your content, media,
database, and URLs on infrastructure you control.

It is a good fit for personal blogs, build logs, technical writing, and small
multi-author publications. BLEX assumes you are comfortable operating Docker
and backups. It is not a hosted service or a zero-runtime static-site generator.

## What you get

| Area | Included |
| --- | --- |
| Writing | Tiptap rich-text editor, drafts, autosave recovery, revision history, previews, scheduled publishing, hidden posts, covers, series, and tags |
| Public blog | Responsive post and author pages, search, comments, likes, pinned posts, notices, banners, and static pages |
| Ownership | Your domain, SQLite database, uploaded media, branding, and deployment |
| Discovery | RSS, sitemaps, canonical and Open Graph metadata, public Markdown URLs, and optional `/llms.txt` |
| Automation | Personal Developer API tokens, scoped permissions, Markdown or HTML publishing, image upload, OpenAPI schema, and request logs |
| Operations | Docker deployment, admin setup, user roles, social login, TOTP two-factor authentication, webhooks, Telegram notifications, and maintenance tools |
| Languages | English and Korean product UI with separate, contributor-friendly translation catalogs; authored content is always preserved as written |

## Try BLEX with Docker

You need Git, Docker, and Docker Compose. These commands start BLEX locally
using the published image:

```bash
git clone https://github.com/baealex/BLEX.git
cd BLEX
cp samples/.env backend/.env
mkdir -p backend/src/resources/media
touch backend/src/db.sqlite3
docker compose up -d
docker compose logs -f blex
```

Open `http://localhost:20002`. The logs print an `Initial setup URL`; open it
to create the first administrator, then write your first post at `/write`.

The sample environment enables English and Korean UI negotiation. Existing
installations can opt in by setting `ENABLE_ENGLISH_UI=TRUE`. BLEX translates
the product interface, not posts or other author-created content.

Before exposing a site publicly:

- replace `SECRET_KEY`, `CIPHER_KEY`, and the initial setup token;
- set `DEBUG=FALSE`, `SITE_URL`, `ALLOWED_HOSTS`, and
  `CSRF_TRUSTED_ORIGINS`;
- put an HTTPS reverse proxy such as Caddy, nginx, Traefik, or Cloudflare
  Tunnel in front of BLEX;
- back up both `backend/src/db.sqlite3` and
  `backend/src/resources/media`.

See the [Self-hosting Guide](docs/SELF_HOSTING.md) for the complete deployment
and recovery checklist.

## Publish once, stay discoverable

BLEX treats the public website as more than rendered HTML.

| Path | Purpose |
| --- | --- |
| `/rss` | Site RSS feed |
| `/sitemap.xml` | Sitemap index |
| `/posts/sitemap.xml` | Public post sitemap |
| `/llms.txt` | Agent entry point when AEO is enabled |
| `/@{username}/{post_url}.md` | Public post as Markdown |
| `/@{username}/series/{series_url}.md` | Public series as Markdown |
| `/static/{slug}.md` | Public static page as Markdown |
| `/api/developer/v1/docs` | Interactive Developer API documentation |
| `/api/developer/v1/openapi.json` | Developer API OpenAPI schema |

Private posts, hidden posts, drafts, deleted posts, and scheduled posts that
are not yet published stay out of RSS, sitemaps, and public Markdown surfaces.

## Developer API

The Developer API lets scripts, personal tools, and AI-assisted workflows
publish without bypassing BLEX's permissions or post lifecycle.

The usual flow is:

1. create a personal token with only the scopes you need;
2. create a Markdown or HTML draft;
3. upload images and update publishing metadata;
4. preview, schedule, or publish the post.

Once BLEX is running, open `/docs/developer-api/quickstart` for the guided
walkthrough or `/api/developer/v1/docs` for the full API.

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

The setup script creates the Python virtual environment and copies the sample
environment when needed. Open `http://localhost:8000` for Django; the React
islands development server runs alongside it.

Common checks:

```bash
npm run server:test
npm run islands:i18n:check
npm run islands:test
npm run islands:lint
npm run islands:type-check
```

## How it is built

BLEX uses Django for server-rendered pages, authentication, permissions, and
publishing workflows. React is loaded as focused islands for interaction-heavy
areas such as the editor and settings, rather than turning the entire site into
a client-side application. SQLite is the default database, and the production
image runs nginx and Gunicorn together with a small-server-friendly default.

## Documentation

- [Self-hosting Guide](docs/SELF_HOSTING.md)
- [Development Convention](docs/DEV_CONVENTION.md)
- [Backend Guide](docs/BACKEND_GUIDE.md)
- [Frontend Guide](docs/FRONTEND_GUIDE.md)
- [Translation Guide](docs/TRANSLATION_GUIDE.md)
- [Testing Guide](docs/TESTING_GUIDE.md)
- [Design Guide](docs/DESIGN_GUIDE.md)

Translation contributions are especially welcome. The translation guide
explains the separate Django, React island, and editor catalogs and how to add
another language without changing application code.

## License

BLEX is available under the [MIT License](LICENSE).

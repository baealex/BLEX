#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend/src"
ENV_FILE="${BLEX_E2E_ENV_FILE:-$REPO_ROOT/samples/.env}"
FIXTURE_FILE="$SCRIPT_DIR/../e2e/fixtures/installed-site.json"
PORT="${PORT:-8000}"
TEMP_ENV_FILE=""
TEMP_DB_FILE=""

cleanup() {
    if [ -n "$TEMP_ENV_FILE" ]; then
        rm -f "$TEMP_ENV_FILE"
    fi

    if [ -n "$TEMP_DB_FILE" ]; then
        rm -f "$TEMP_DB_FILE"
    fi
}

trap cleanup EXIT

if [ -f "$BACKEND_DIR/mvenv/bin/activate" ] && [ -z "${VIRTUAL_ENV:-}" ]; then
    # Local development usually keeps Django dependencies in this venv.
    source "$BACKEND_DIR/mvenv/bin/activate"
fi

if [ -f "$ENV_FILE" ]; then
    TEMP_ENV_FILE="$(mktemp)"
    sed 's/\r$//' "$ENV_FILE" > "$TEMP_ENV_FILE"

    set -a
    # shellcheck disable=SC1090
    source "$TEMP_ENV_FILE"
    set +a
fi

if [ -n "${BLEX_E2E_DB_PATH:-}" ]; then
    export BLEX_SQLITE_DB_PATH="$BLEX_E2E_DB_PATH"
else
    TEMP_DB_BASE="$(mktemp "${TMPDIR:-/tmp}/blex-smoke-db.XXXXXX")"
    TEMP_DB_FILE="$TEMP_DB_BASE.sqlite3"
    rm -f "$TEMP_DB_BASE"
    export BLEX_SQLITE_DB_PATH="$TEMP_DB_FILE"
fi

export DEBUG=TRUE
export USE_VITE_DEV_SERVER=FALSE
export SITE_URL="http://127.0.0.1:$PORT"
export SESSION_COOKIE_DOMAIN=""

cd "$BACKEND_DIR"
python manage.py migrate --noinput
python manage.py loaddata "$FIXTURE_FILE"
python manage.py runserver "127.0.0.1:$PORT" --noreload --nostatic

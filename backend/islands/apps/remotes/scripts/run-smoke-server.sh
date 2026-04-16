#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend/src"
ENV_FILE="${BLEX_E2E_ENV_FILE:-$REPO_ROOT/samples/.env}"
PORT="${PORT:-8000}"

if [ -f "$BACKEND_DIR/mvenv/bin/activate" ] && [ -z "${VIRTUAL_ENV:-}" ]; then
    # Local development usually keeps Django dependencies in this venv.
    source "$BACKEND_DIR/mvenv/bin/activate"
fi

if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

export DEBUG=TRUE
export USE_VITE_DEV_SERVER=FALSE
export SITE_URL="http://127.0.0.1:$PORT"
export SESSION_COOKIE_DOMAIN=""

cd "$BACKEND_DIR"
python manage.py migrate --noinput
python manage.py runserver "127.0.0.1:$PORT" --noreload --nostatic

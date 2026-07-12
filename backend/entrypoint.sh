#!/bin/sh

set -eu

# Generate admin path if not set
if [ -z "${ADMIN_PATH:-}" ]; then
    ADMIN_PATH=$(python -c "import secrets; print(secrets.token_urlsafe(16))")
    export ADMIN_PATH
fi

if [ -z "${INITIAL_SETUP_TOKEN:-}" ]; then
    INITIAL_SETUP_TOKEN=$(python -c "import secrets; print(secrets.token_urlsafe(24))")
    export INITIAL_SETUP_TOKEN
fi

SETUP_URL="${SITE_URL:-http://localhost}/setup?token=$INITIAL_SETUP_TOKEN"

echo "Admin path: /$ADMIN_PATH/"
echo "Initial setup URL: $SETUP_URL"

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
    python manage.py migrate --noinput
fi

gunicorn "$@" &
gunicorn_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

stop_services() {
    kill -TERM "$gunicorn_pid" "$nginx_pid" 2>/dev/null || true
    wait "$gunicorn_pid" 2>/dev/null || true
    wait "$nginx_pid" 2>/dev/null || true
}

handle_signal() {
    stop_services
    exit 0
}

trap handle_signal INT TERM

while kill -0 "$gunicorn_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
    sleep 1
done

if ! kill -0 "$gunicorn_pid" 2>/dev/null; then
    if wait "$gunicorn_pid"; then
        exit_code=1
    else
        exit_code=$?
    fi
else
    if wait "$nginx_pid"; then
        exit_code=1
    else
        exit_code=$?
    fi
fi

stop_services
exit "$exit_code"

#!/bin/sh

# Generate admin path if not set
if [ -z "$ADMIN_PATH" ]; then
    export ADMIN_PATH=$(python -c "import secrets; print(secrets.token_urlsafe(16))")
fi

if [ -z "$INITIAL_SETUP_TOKEN" ]; then
    export INITIAL_SETUP_TOKEN=$(python -c "import secrets; print(secrets.token_urlsafe(24))")
fi

SETUP_URL="${SITE_URL:-http://localhost:8000}/setup?token=$INITIAL_SETUP_TOKEN"

echo "Admin path: /$ADMIN_PATH/"
echo "Initial setup URL: $SETUP_URL"

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
    python manage.py migrate --noinput
fi

# Execute gunicorn with all arguments
exec gunicorn "$@"

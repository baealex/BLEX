#!/bin/sh

# Generate admin path if not set
if [ -z "$ADMIN_PATH" ]; then
    export ADMIN_PATH=$(python -c "import secrets; print(secrets.token_urlsafe(16))")
fi

echo "🔐 Admin path: /$ADMIN_PATH/"

# Execute gunicorn with all arguments
exec gunicorn "$@"

"""
Dynamic Admin Path Module

Generates a random admin path on server startup for security.
The path changes on every server restart.
"""
import secrets


# Generate random admin path on module import (server startup)
# Using 16 bytes = 22 characters of URL-safe base64
ADMIN_PATH = secrets.token_urlsafe(16)

# Log the admin path on startup (visible in server console)
print(f"\n🔐 Admin path generated: /{ADMIN_PATH}/\n")


def get_admin_path():
    """Returns the current random admin path."""
    return ADMIN_PATH


def get_admin_url():
    """Returns the full admin URL path with trailing slash."""
    return f'/{ADMIN_PATH}/'

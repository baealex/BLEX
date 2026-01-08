"""
Dynamic Admin Path Module

Uses ADMIN_PATH environment variable if set, otherwise generates a random path.
For production with multiple workers, set ADMIN_PATH in environment.
"""
import os
import secrets


# Use environment variable if set, otherwise generate random path
ADMIN_PATH = os.environ.get('ADMIN_PATH') or secrets.token_urlsafe(16)

# Log the admin path on startup (visible in server console)
print(f"\n🔐 Admin path: /{ADMIN_PATH}/\n")


def get_admin_path():
    """Returns the current admin path."""
    return ADMIN_PATH


def get_admin_url():
    """Returns the full admin URL path with trailing slash."""
    return f'/{ADMIN_PATH}/'

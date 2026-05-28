import os
import sys
import django

from urllib.parse import urlsplit

from django.utils.encoding import force_str

django.utils.encoding.force_text = force_str

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_env_int(name: str, default: int = 0) -> int:
    value = os.environ.get(name)
    if value is None or value.strip() == '':
        return default

    return int(value.strip())


def get_env_list(name: str, default: list[str] | None = None) -> list[str]:
    value = os.environ.get(name)
    if value is None or value.strip() == '':
        return list(default or [])

    return [
        item.strip()
        for item in value.split(',')
        if item.strip()
    ]


def get_env_optional(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None or value.strip() == '':
        return None

    return value.strip()


def get_session_cookie_domain(name: str = 'SESSION_COOKIE_DOMAIN') -> str | None:
    domain = get_env_optional(name)
    if not domain:
        return None

    if domain.lstrip('.').lower() in {'localhost', '127.0.0.1', '0.0.0.0', '::1'}:
        return None

    return domain


def get_env_http_origin(name: str) -> str | None:
    origin = get_env_optional(name)
    if not origin:
        return None

    origin = origin.rstrip('/')
    parsed_origin = urlsplit(origin)
    if parsed_origin.scheme not in {'http', 'https'} or not parsed_origin.netloc:
        return None

    if parsed_origin.path not in {'', '/'} or parsed_origin.query or parsed_origin.fragment:
        return None

    if parsed_origin.username or parsed_origin.password:
        return None

    return origin


SECRET_KEY = os.environ.get('SECRET_KEY')

CIPHER_KEY = os.environ.get('CIPHER_KEY').encode()

DEBUG = os.environ.get('DEBUG') == 'TRUE'
USE_VITE_DEV_SERVER = DEBUG and os.environ.get('USE_VITE_DEV_SERVER', 'TRUE') == 'TRUE'
VITE_DEV_SERVER_URL = os.environ.get('VITE_DEV_SERVER_URL', 'http://localhost:8100')

TESTING = sys.argv[1:2] == ['test']

ALLOWED_HOSTS = get_env_list('ALLOWED_HOSTS', ['*'])
SITE_URL_ORIGIN = get_env_http_origin('SITE_URL')
CSRF_TRUSTED_ORIGINS = get_env_list(
    'CSRF_TRUSTED_ORIGINS',
    [SITE_URL_ORIGIN] if SITE_URL_ORIGIN else [],
)

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'django.contrib.sitemaps',
    'django.contrib.humanize',
    'graphene_django',
    'corsheaders',
    'ninja',
    'board',
]

AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
)

SITE_ID = 1

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'main.middleware.HTMLMinifyMiddleware',
    'main.middleware.SearchIndexingMiddleware',
]

if not DEBUG:
    MIDDLEWARE.append('main.middleware.AccessAdminOnlyStaff')
    MIDDLEWARE.append('main.middleware.AccessSitemapOnlyBot')

if DEBUG and not TESTING:
    MIDDLEWARE.append('main.middleware.QueryDebugger')

CORS_ALLOWED_ORIGINS = [SITE_URL_ORIGIN] if SITE_URL_ORIGIN else []

CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_DOMAIN = get_session_cookie_domain()

ROOT_URLCONF = 'main.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'board.context_processors.oauth_settings',
                'board.context_processors.site_settings',
                'board.context_processors.global_notices',
                'board.context_processors.footer_pages',
                'board.context_processors.admin_url_context',
                'board.context_processors.debug_mode',
            ],
        },
    },
]

WSGI_APPLICATION = 'main.wsgi.application'

FILE_UPLOAD_PERMISSIONS = 0o644
DEVELOPER_API_MAX_UPLOAD_MB = max(get_env_int('DEVELOPER_API_MAX_UPLOAD_MB', 20), 1)
DEVELOPER_API_MAX_UPLOAD_BYTES = DEVELOPER_API_MAX_UPLOAD_MB * 1024 * 1024
DEVELOPER_API_LOG_RETENTION_DAYS = max(get_env_int('DEVELOPER_API_LOG_RETENTION_DAYS', 30), 1)

DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

SQLITE_DB_PATH = os.environ.get(
    'BLEX_SQLITE_DB_PATH',
    os.path.join(BASE_DIR, 'db.sqlite3'),
)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': SQLITE_DB_PATH,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'ko'

TIME_ZONE = os.environ.get('TZ')

USE_I18N = True

USE_L10N = True

USE_TZ = True




SITE_URL = os.environ.get('SITE_URL')
RESOURCE_URL = os.environ.get('RESOURCE_URL', '').rstrip('/') + '/resources/'

STATIC_URL = RESOURCE_URL + 'staticfiles/'
STATIC_ROOT = os.path.join(BASE_DIR, 'resources', 'staticfiles')
VITE_DEV_SERVER_INFO_PATH = os.environ.get(
    'VITE_DEV_SERVER_INFO_PATH',
    os.path.join(STATIC_ROOT, 'islands', '.vite', 'dev-server.json'),
)

MEDIA_URL = RESOURCE_URL + 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'resources', 'media')

# Extension (Telegram)

TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHANNEL_ID = os.environ.get('TELEGRAM_CHANNEL_ID')
TELEGRAM_ERROR_REPORT_ID = os.environ.get('TELEGRAM_ERROR_REPORT_ID')


# Extension (OAuth)

GOOGLE_OAUTH_CLIENT_ID = os.environ.get('GOOGLE_OAUTH_CLIENT_ID')
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET')
GITHUB_OAUTH_CLIENT_ID = os.environ.get('GITHUB_OAUTH_CLIENT_ID')
GITHUB_OAUTH_CLIENT_SECRET = os.environ.get('GITHUB_OAUTH_CLIENT_SECRET')


# Extension (Captcha)

HCAPTCHA_SITE_KEY = os.environ.get('HCAPTCHA_SITE_KEY')
HCAPTCHA_SECRET_KEY = os.environ.get('HCAPTCHA_SECRET_KEY')


# Initial setup

INITIAL_SETUP_TOKEN = os.environ.get('INITIAL_SETUP_TOKEN', '')


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.template': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'board': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}

LOGIN_URL = '/login'
LOGOUT_REDIRECT_URL = '/'

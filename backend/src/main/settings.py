import os
import sys
import django

from django.utils.encoding import force_str

# NOTE: Monkey patching for GraphQL in Django 4
django.utils.encoding.force_text = force_str

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = os.environ.get('SECRET_KEY')

CIPHER_KEY = os.environ.get('CIPHER_KEY').encode()

DEBUG = os.environ.get('DEBUG') == 'TRUE'

TESTING = sys.argv[1:2] == ['test']

ALLOWED_HOSTS = ['*']

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
    'main.middleware.DisableCSRF',
    'main.middleware.HTMLMinifyMiddleware',
]

if not DEBUG:
    MIDDLEWARE.append('main.middleware.AccessAdminOnlyStaff')
    MIDDLEWARE.append('main.middleware.AccessSitemapOnlyBot')

if DEBUG and not TESTING:
    MIDDLEWARE.append('main.middleware.QueryDebugger')

CORS_ALLOWED_ORIGINS = [
    os.environ.get('SITE_URL'),
]

CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_DOMAIN = os.environ.get('SESSION_COOKIE_DOMAIN')

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
            ],
        },
    },
]

WSGI_APPLICATION = 'main.wsgi.application'

FILE_UPLOAD_PERMISSIONS = 0o644

DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
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


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/2.0/howto/static-files/

SITE_URL = os.environ.get('SITE_URL')
RESOURCE_URL = os.environ.get('RESOURCE_URL') + '/resources/'

STATIC_URL = RESOURCE_URL + 'staticfiles/'
STATIC_ROOT = os.path.join(BASE_DIR, 'resources', 'staticfiles')

MEDIA_URL = RESOURCE_URL + 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'resources', 'media')

# Extension (Telegram)

TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHANNEL_ID = os.environ.get('TELEGRAM_CHANNEL_ID')
TELEGRAM_ERROR_REPORT_ID = os.environ.get('TELEGRAM_ERROR_REPORT_ID')


# Extension (Discord)

DISCORD_NEW_POSTS_WEBHOOK = os.environ.get('DISCORD_NEW_POSTS_WEBHOOK')


# Extension (OAuth)

GOOGLE_OAUTH_CLIENT_ID = os.environ.get('GOOGLE_OAUTH_CLIENT_ID')
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET')
GITHUB_OAUTH_CLIENT_ID = os.environ.get('GITHUB_OAUTH_CLIENT_ID')
GITHUB_OAUTH_CLIENT_SECRET = os.environ.get('GITHUB_OAUTH_CLIENT_SECRET')


# Extension (Captcha)

HCAPTCHA_SITE_KEY = os.environ.get('HCAPTCHA_SITE_KEY')
HCAPTCHA_SECRET_KEY = os.environ.get('HCAPTCHA_SECRET_KEY')


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

LOGOUT_REDIRECT_URL = '/'

SUPPORTED_SOCIAL_AUTH_PROVIDERS = {
    'google': {
        'name': 'Google',
    },
    'github': {
        'name': 'GitHub',
    },
}

SUPPORTED_SOCIAL_AUTH_PROVIDER_CHOICES = tuple(
    (key, provider['name'])
    for key, provider in SUPPORTED_SOCIAL_AUTH_PROVIDERS.items()
)

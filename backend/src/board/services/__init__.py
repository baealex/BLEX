"""
Service Layer

This package contains business logic extracted from views.
Services handle complex business operations and can be reused across views.
"""

from importlib import import_module

_SERVICE_MODULES = {
    'PostService': 'post_service',
    'PostThumbnailService': 'post_thumbnail_service',
    'ProfileImageService': 'profile_image_service',
    'AuthService': 'auth_service',
    'BannerService': 'banner_service',
    'CommentService': 'comment_service',
    'PinnedPostService': 'pinned_post_service',
    'SeriesService': 'series_service',
    'TagService': 'tag_service',
    'UserService': 'user_service',
    'WebhookService': 'webhook_service',
}

__all__ = list(_SERVICE_MODULES)


def __getattr__(name):
    module_name = _SERVICE_MODULES.get(name)
    if module_name is None:
        raise AttributeError(f'module {__name__!r} has no attribute {name!r}')

    module = import_module(f'{__name__}.{module_name}')
    service = getattr(module, name)
    globals()[name] = service
    return service

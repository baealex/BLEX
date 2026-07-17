"""Backward-compatible facade for the board model package."""

from types import FunctionType as _FunctionType

from django.contrib.auth.models import User
from django.utils import timezone

from .helpers import (
    avatar_path,
    cover_path,
    create_description,
    get_user_hex,
    title_image_path,
)
from .posts import (
    Comment,
    EditHistory,
    EditRequest,
    Form,
    ImageCache,
    PinnedPost,
    Post,
    PostConfig,
    PostConfigMeta,
    PostContent,
    PostLikes,
    Series,
    SeriesConfigMeta,
    Tag,
)
from .accounts import (
    AuthorInvite,
    Config,
    EmailChange,
    LoginSetting,
    Profile,
    SocialAuth,
    SocialAuthProvider,
    TwoFactorAuth,
    UserConfigMeta,
    UserLinkMeta,
    UsernameChangeLog,
)
from .integrations import (
    DeveloperRequestLog,
    DeveloperToken,
    IntegrationSetting,
    Notify,
    SiteContentScope,
    TelegramSync,
    UtilityCleanupConfirmation,
    WebhookSubscription,
)
from .site import (
    BannerPosition,
    BannerType,
    SiteBanner,
    SiteContentBase,
    SiteNotice,
    SiteSetting,
    StaticPage,
)


__all__ = (
    'AuthorInvite',
    'BannerPosition',
    'BannerType',
    'Comment',
    'Config',
    'DeveloperRequestLog',
    'DeveloperToken',
    'EditHistory',
    'EditRequest',
    'EmailChange',
    'Form',
    'ImageCache',
    'IntegrationSetting',
    'LoginSetting',
    'Notify',
    'PinnedPost',
    'Post',
    'PostConfig',
    'PostConfigMeta',
    'PostContent',
    'PostLikes',
    'Profile',
    'Series',
    'SeriesConfigMeta',
    'SiteBanner',
    'SiteContentBase',
    'SiteContentScope',
    'SiteNotice',
    'SiteSetting',
    'SocialAuth',
    'SocialAuthProvider',
    'StaticPage',
    'Tag',
    'TelegramSync',
    'TwoFactorAuth',
    'UtilityCleanupConfirmation',
    'User',
    'UserConfigMeta',
    'UserLinkMeta',
    'UsernameChangeLog',
    'WebhookSubscription',
    'avatar_path',
    'cover_path',
    'create_description',
    'get_user_hex',
    'timezone',
    'title_image_path',
)


_COMPAT_MODULE_EXPORTS = (
    AuthorInvite,
    BannerPosition,
    BannerType,
    Comment,
    Config,
    DeveloperRequestLog,
    DeveloperToken,
    EditHistory,
    EditRequest,
    EmailChange,
    Form,
    ImageCache,
    IntegrationSetting,
    LoginSetting,
    Notify,
    PinnedPost,
    Post,
    PostConfig,
    PostConfig.CoverImagePosition,
    PostConfig.CoverImageRatio,
    PostConfig.CoverLayout,
    PostConfigMeta,
    PostContent,
    PostLikes,
    Profile,
    Profile.Role,
    Series,
    SeriesConfigMeta,
    SiteBanner,
    SiteContentBase,
    SiteContentScope,
    SiteNotice,
    SiteSetting,
    SocialAuth,
    SocialAuthProvider,
    StaticPage,
    Tag,
    TelegramSync,
    TwoFactorAuth,
    UtilityCleanupConfirmation,
    UserConfigMeta,
    UserLinkMeta,
    UsernameChangeLog,
    WebhookSubscription,
    avatar_path,
    cover_path,
    create_description,
    get_user_hex,
    title_image_path,
)

for _export in _COMPAT_MODULE_EXPORTS:
    _export.__module__ = __name__
    if isinstance(_export, type):
        for _member in vars(_export).values():
            if isinstance(_member, _FunctionType):
                _member.__module__ = __name__
            elif isinstance(_member, (classmethod, staticmethod)):
                _member.__func__.__module__ = __name__
            elif isinstance(_member, property):
                for _accessor in (_member.fget, _member.fset, _member.fdel):
                    if _accessor is not None:
                        _accessor.__module__ = __name__

del _export

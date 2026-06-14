import datetime
import hashlib
import pyotp

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum, Count
from django.template.defaultfilters import truncatewords
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from django.utils.html import strip_tags

from dateutil import parser as dateutil_parser
from modules.hash import get_sha256
from modules.randomness import randstr
from board.constants.config_meta import CONFIG_TYPE
from board.modules.time import time_since, time_stamp
from board.services.post_content_service import PostContentService
from board.services.post_thumbnail_service import PostThumbnailService
from board.services.profile_image_service import ProfileImageService
from board.services.notification_delivery_service import NotificationDeliveryService
from board.services.webhook_subscription_state_service import WebhookSubscriptionStateService
from board.services.user_config_meta_service import UserConfigMetaService
from board.services.series_save_service import SeriesSaveService
from board.services.telegram_sync_encryption_service import TelegramSyncEncryptionService
from board.services.integration_setting_service import IntegrationSettingService
from board.constants.social_auth import (
    SUPPORTED_SOCIAL_AUTH_PROVIDERS,
    SUPPORTED_SOCIAL_AUTH_PROVIDER_CHOICES,
)


def get_user_hex(username):
    return hashlib.md5(username.encode()).hexdigest()[:2]


def cover_path(instance, filename):
    hex_prefix = get_user_hex(instance.user.username)
    return f"images/avatar/{hex_prefix}/{instance.user.username}/c{randstr(4)}.{filename.split('.')[-1]}"


def avatar_path(instance, filename):
    hex_prefix = get_user_hex(instance.user.username)
    return f"images/avatar/{hex_prefix}/{instance.user.username}/a{randstr(4)}.{filename.split('.')[-1]}"


def create_description(text):
    return truncatewords(strip_tags(text), 50)


def title_image_path(instance, filename):
    dt = datetime.datetime.now()
    path = f"images/title/{dt.year}/{dt.month}/{dt.day}/{instance.author.username}"
    name = f"{dt.hour}_{randstr(8)}.{filename.split('.')[-1]}"
    return f"{path}/{name}"


class Comment(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['post', 'parent', 'created_date']),
            models.Index(fields=['author', 'created_date']),
        ]

    author = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    post = models.ForeignKey('board.Post', related_name='comments', on_delete=models.CASCADE)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    text_md = models.TextField(max_length=500)
    text_html = models.TextField()
    edited = models.BooleanField(default=False)
    heart = models.BooleanField(default=False)
    likes = models.ManyToManyField('auth.User', related_name='like_comments', blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def author_username(self):
        if not self.author:
            return 'Ghost'
        return self.author.username

    def get_text_html(self):
        if not self.author:
            return '<p>삭제된 댓글입니다.</p>'
        return self.text_html

    def get_thumbnail(self):
        if self.image:
            return self.image.url
        return None

    def get_absolute_url(self):
        return self.post.get_absolute_url()

    def time_since(self):
        return time_since(self.created_date)

    def is_deleted(self):
        return self.author is None

    def is_reply(self):
        return self.parent is not None

    def get_replies(self):
        return self.replies.all().order_by('created_date')

    def clean(self):
        from django.core.exceptions import ValidationError
        # 1레벨 제한: 대댓글의 대댓글 방지
        if self.parent and self.parent.parent:
            raise ValidationError('대댓글에는 답글을 달 수 없습니다.')

    def __str__(self):
        return self.text_md


class EmailChange(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    email = models.CharField(max_length=255)
    auth_token = models.CharField(max_length=8, blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def is_token_expire(self):
        seven_day_ago = timezone.now() - datetime.timedelta(days=7)
        if self.created_date < seven_day_ago:
            return True
        return False

    def __str__(self):
        return self.user.username


class UserConfigMeta(models.Model):
    user = models.ForeignKey('auth.User', related_name='conf_meta', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.user.username


class Config(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)

    def create_or_update_meta(self, config: CONFIG_TYPE, value):
        return UserConfigMetaService.create_or_update_meta(self, config, value)

    def get_meta(self, config: CONFIG_TYPE):
        return UserConfigMetaService.get_meta(self, config)

    def has_telegram_id(self):
        if hasattr(self.user, 'telegramsync'):
            if not self.user.telegramsync.tid == '':
                return True
        return False

    def has_two_factor_auth(self):
        if hasattr(self.user, 'twofactorauth'):
            return True
        return False

    def __str__(self):
        return self.user.username


class Form(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title = models.CharField(max_length=50)
    content = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title


class ImageCache(models.Model):
    user = models.ForeignKey('auth.User', null=True, on_delete=models.SET_NULL)
    key = models.CharField(max_length=44, unique=True)
    path = models.CharField(max_length=128, unique=True)
    size = models.IntegerField(default=0)

    def __str__(self):
        return self.path


class Notify(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    key = models.CharField(max_length=44, unique=True)
    url = models.CharField(max_length=255)
    content = models.TextField()
    has_read = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    @staticmethod
    def create_hash_key(user: User, url: str, content: str, hidden_key: str = None):
        return get_sha256(user.username + url + content + (hidden_key if hidden_key else ''))

    def send_notify(self):
        NotificationDeliveryService.send_telegram_notification(self)

    def to_dict(self):
        return {
            'id': self.id,
            'user': self.user.username,
            'content': self.content,
            'created_date': time_since(self.created_date)
        }

    def time_since(self):
        return time_since(self.created_date)

    def __str__(self):
        return str(self.user)



class Tag(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['value']),
        ]

    value = models.CharField(max_length=50)

    def get_image(self):
        post = self.posts.filter(
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
            tags__value=self.value,
            image__contains='images'
        ).order_by('-created_date').first()

        return post.image.url if post else ''

    def __str__(self):
        return str(self.value)


class Post(models.Model):
    DEFAULT_COVER_COUNT = 6

    class Meta:
        indexes = [
            models.Index(fields=['author', 'created_date']),
            models.Index(fields=['created_date']),
            models.Index(fields=['url']),
            models.Index(fields=['published_date']),
            models.Index(fields=['author', 'published_date']),
        ]

    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    series = models.ForeignKey('board.Series', related_name='posts', on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=65)
    subtitle = models.CharField(max_length=120, blank=True, default='')
    url = models.SlugField(max_length=65, unique=True, allow_unicode=True)
    image = models.ImageField(blank=True, upload_to=title_image_path)
    image_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)
    read_time = models.IntegerField(default=0)
    tags = models.ManyToManyField(Tag, related_name='posts', blank=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)
    published_date = models.DateTimeField(null=True, blank=True)
    meta_description = models.CharField(max_length=250, blank=True)

    def create_unique_url(self, url=None):
        url = url if url else slugify(self.title, allow_unicode=True)

        post = Post.objects.filter(url=url)
        if self.pk:
            post = post.exclude(pk=self.pk)

        while post.exists():
            url = url + '-' + randstr(8)
            post = Post.objects.filter(url=url)
            if self.pk:
                post = post.exclude(pk=self.pk)

        self.url = url

    def get_default_cover_index(self):
        seed = self.url or str(self.pk or self.title)
        digest = hashlib.md5(seed.encode()).hexdigest()
        return int(digest[:8], 16) % self.DEFAULT_COVER_COUNT + 1

    def get_default_cover_path(self):
        return f'assets/images/default-cover-{self.get_default_cover_index()}.jpg'

    def get_default_cover_url(self):
        return settings.RESOURCE_URL + self.get_default_cover_path()

    def get_image(self):
        if self.image:
            return self.image.url
        return self.get_default_cover_url()

    def is_published(self):
        from board.services.post_status_service import PostStatusService
        return PostStatusService.is_published(self)

    def is_draft(self):
        from board.services.post_status_service import PostStatusService
        return PostStatusService.is_draft(self)

    def time_stamp(self):
        return time_stamp(self.created_date)

    def get_absolute_url(self):
        return reverse('post_detail', args=[self.author.username, self.url])

    def time_since(self):
        return time_since(self.created_date)

    def tagging(self):
        return [tag.value for tag in self.tags.all() if tag]

    def get_thumbnail(self):
        if self.image:
            return self.image.url
        return None

    def get_minify_image(self):
        if self.image:
            try:
                ext = self.image.name.split('.')[-1]
                return f"{self.image.url}.minify.{ext}"
            except:
                return self.image.url
        return self.get_image()

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        will_make_thumbnail = PostThumbnailService.should_generate(self)
        super(Post, self).save(*args, **kwargs)
        if will_make_thumbnail:
            PostThumbnailService.generate_thumbnail_set(self)


class PostContent(models.Model):
    post = models.OneToOneField('board.Post', related_name='content', on_delete=models.CASCADE)
    content_html = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if self.post and not getattr(self, '_skip_read_time_sync', False):
            PostContentService.sync_parent_read_time(self.post, self.content_html)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.post.title


class PostConfig(models.Model):
    class CoverLayout(models.TextChoices):
        DEFAULT = 'default', '기본'
        SPLIT = 'split', '분할'
        OVERLAY = 'overlay', '이미지 배경'
        NONE = 'none', '커버 숨김'

    class CoverImagePosition(models.TextChoices):
        RIGHT = 'right', '오른쪽'
        LEFT = 'left', '왼쪽'

    class CoverImageRatio(models.TextChoices):
        AUTO = 'auto', '원본'
        WIDE = '16:9', '16:9'
        STANDARD = '4:3', '4:3'
        SQUARE = '1:1', '1:1'
        PORTRAIT = '3:4', '3:4'

    post = models.OneToOneField('board.Post', related_name='config', on_delete=models.CASCADE)
    hide = models.BooleanField(default=False)
    advertise = models.BooleanField(default=False)
    block_comment = models.BooleanField(default=False)
    cover_layout = models.CharField(
        max_length=16,
        choices=CoverLayout.choices,
        default=CoverLayout.DEFAULT,
    )
    cover_image_position = models.CharField(
        max_length=8,
        choices=CoverImagePosition.choices,
        default=CoverImagePosition.RIGHT,
    )
    cover_image_ratio = models.CharField(
        max_length=8,
        choices=CoverImageRatio.choices,
        default=CoverImageRatio.AUTO,
    )

    def __str__(self):
        return self.post.title


class PostConfigMeta(models.Model):
    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)


class PinnedPost(models.Model):
    post = models.ForeignKey('board.Post', related_name='pinned', on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    order = models.IntegerField(default=0) 
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return str(self.post)


class PostLikes(models.Model):
    class Meta:
        db_table = 'board_post_likes'
        indexes = [
            models.Index(fields=['post', 'user']),
            models.Index(fields=['user', 'created_date']),
        ]

    post = models.ForeignKey('board.Post', related_name='likes', on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def time_since(self):
        return time_since(self.created_date)

    def __str__(self):
        return str(self.post)


class UserLinkMeta(models.Model):
    order = models.IntegerField(default=0)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.user.username


class Profile(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    bio = models.TextField(max_length=500, blank=True)
    cover = models.ImageField(blank=True, upload_to=cover_path)
    avatar = models.ImageField(blank=True, upload_to=avatar_path)
    homepage = models.CharField(max_length=100, blank=True)
    about_md = models.TextField(blank=True)
    about_html = models.TextField(blank=True)

    # Analytics integration (Share URL from analytics provider)
    analytics_share_url = models.URLField(max_length=500, blank=True,
                                           help_text='분석 도구 공유 URL (예: Umami, Google Analytics 등)')

    # User role for permission control
    class Role(models.TextChoices):
        READER = 'READER', '독자'
        EDITOR = 'EDITOR', '작가'

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.READER,
        help_text='사용자 역할 (독자: 읽기만, 작가: 글 작성 및 통계)'
    )

    def is_editor(self):
        """Check if user has editor role"""
        return self.role == self.Role.EDITOR

    def collect_social(self):
        socials = []
        for meta in UserLinkMeta.objects.filter(user=self.user).order_by('order'):
            socials.append({
                'id': meta.id,
                'name': meta.name,
                'value': meta.value,
                'order': meta.order
            })
        return socials

    def get_thumbnail(self):
        if self.avatar:
            return self.avatar.url
        return settings.RESOURCE_URL + 'assets/images/default-avatar.jpg'

    def total_channels(self):
        """Return count of active notification channels"""
        return self.webhook_subscribers.filter(is_active=True).count()

    def save(self, *args, **kwargs):
        previous_role = None
        if self.pk:
            previous_role = Profile.objects.filter(pk=self.pk).values_list('role', flat=True).first()

        is_demoting_to_reader = previous_role == self.Role.EDITOR and self.role == self.Role.READER
        will_make_thumbnail = ProfileImageService.should_generate_avatar_thumbnail(self)

        super(Profile, self).save(*args, **kwargs)

        if is_demoting_to_reader:
            Post.objects.filter(
                author=self.user,
                published_date__gt=timezone.now(),
            ).update(
                published_date=None,
                updated_date=timezone.now(),
            )

        if will_make_thumbnail:
            ProfileImageService.generate_avatar_thumbnail(self)

    def get_absolute_url(self):
        return reverse('user_profile', args=[self.user.username])

    def __str__(self):
        return self.user.username


class Series(models.Model):
    order = models.IntegerField(default=0)
    owner = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    text_md = models.TextField(blank=True)
    text_html = models.TextField(blank=True)
    hide = models.BooleanField(default=False)
    url = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    layout = models.CharField(max_length=5, default='list')
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def create_unique_url(self, url=None):
        SeriesSaveService.create_unique_url(self, url)

    def thumbnail(self):
        post = Post.objects.filter(
            series=self,
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
        ).first()
        return post.get_thumbnail() if post else ''

    def get_absolute_url(self):
        return reverse('series_detail', args=[self.owner.username, self.url])

    def time_since(self):
        return time_since(self.created_date)

    def save(self, *args, **kwargs):
        SeriesSaveService.prepare_for_save(self)
        super(Series, self).save(*args, **kwargs)

    def __str__(self):
        return self.name


class SeriesConfigMeta(models.Model):
    post = models.ForeignKey('board.Series', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)


class TelegramSync(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    tid = models.CharField(max_length=200, blank=True) # encrypted
    auth_token = models.CharField(max_length=8, blank=True)
    auth_token_exp = models.DateTimeField(default=timezone.now)
    created_date = models.DateTimeField(default=timezone.now)

    def get_decrypted_tid(self):
        return TelegramSyncEncryptionService.get_decrypted_tid(self)

    def is_token_expire(self):
        one_day_ago = timezone.now() - datetime.timedelta(days=1)
        if self.created_date < one_day_ago:
            return True
        return False

    def __str__(self):
        return self.user.username
    
    def save(self, *args, **kwargs):
        TelegramSyncEncryptionService.prepare_for_save(self)
        super().save(*args, **kwargs)
    
    def _is_encrypted(self, value):
        return TelegramSyncEncryptionService.is_encrypted(value)



class TwoFactorAuth(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    recovery_key = models.CharField(max_length=45, blank=True)
    totp_secret = models.CharField(max_length=32, blank=True)  # TOTP secret key
    created_date = models.DateTimeField(default=timezone.now)

    def has_been_a_day(self):
        one_day_ago = timezone.now() - datetime.timedelta(days=1)
        if self.created_date < one_day_ago:
            return True
        return False

    def verify_totp(self, token):
        """Verify TOTP token"""
        if not self.totp_secret:
            return False
        totp = pyotp.TOTP(self.totp_secret)
        return totp.verify(token, valid_window=1)  # Allow 30s window on each side

    def get_provisioning_uri(self):
        """Get provisioning URI for QR code"""
        if not self.totp_secret:
            return None
        totp = pyotp.TOTP(self.totp_secret)
        return totp.provisioning_uri(
            name=self.user.email,
            issuer_name='BLEX'
        )

    def __str__(self):
        return self.user.username


class DeveloperToken(models.Model):
    user = models.ForeignKey(
        'auth.User',
        on_delete=models.CASCADE,
        related_name='developer_tokens',
    )
    name = models.CharField(max_length=100)
    token_prefix = models.CharField(max_length=16, unique=True)
    token_hash = models.CharField(max_length=64, unique=True)
    scopes = models.JSONField(default=list)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    last_used_ip = models.GenericIPAddressField(null=True, blank=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_date']
        indexes = [
            models.Index(fields=['user', 'revoked_at']),
            models.Index(fields=['token_prefix']),
        ]

    def is_valid(self):
        if self.revoked_at is not None:
            return False
        if self.expires_at is not None and self.expires_at <= timezone.now():
            return False
        return True

    def has_scope(self, scope):
        return scope in self.scopes

    def __str__(self):
        return f'{self.user.username} - {self.name}'


class DeveloperRequestLog(models.Model):
    user = models.ForeignKey(
        'auth.User',
        on_delete=models.CASCADE,
        related_name='developer_request_logs',
    )
    token = models.ForeignKey(
        'board.DeveloperToken',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='request_logs',
    )
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=255)
    status_code = models.PositiveSmallIntegerField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_date']
        indexes = [
            models.Index(fields=['user', 'created_date']),
            models.Index(fields=['token', 'created_date']),
        ]

    def __str__(self):
        return f'{self.method} {self.path} {self.status_code}'


class EditHistory(models.Model):
    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    title = models.CharField(max_length=50, default='_NO_CHANGED_')
    content = models.TextField(blank=True, default='_NO_CHANGED_')
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.posts


class EditRequest(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    title = models.CharField(max_length=50, default='_NO_CHANGED_')
    content = models.TextField(blank=True, default='_NO_CHANGED_')
    is_merged = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title


class SiteContentScope(models.TextChoices):
    USER = 'user', '사용자'
    GLOBAL = 'global', '전역'


class WebhookSubscription(models.Model):
    """
    Webhook channel registration.
    - author is set: author-specific channel (existing behavior)
    - author is null: global channel (new behavior)
    """
    MAX_FAILURES = 3  # Auto-deactivate after this many consecutive failures

    scope = models.CharField(
        max_length=10,
        choices=SiteContentScope.choices,
        default=SiteContentScope.USER
    )
    author = models.ForeignKey(
        'board.Profile',
        on_delete=models.CASCADE,
        related_name='webhook_subscribers',
        null=True,
        blank=True,
        help_text='Owner profile for author-specific channel (empty for global channel)'
    )
    webhook_url = models.URLField(
        max_length=500,
        help_text='Webhook URL (Discord, Slack, etc.)'
    )
    name = models.CharField(
        max_length=100,
        blank=True,
        help_text='Optional name/description for this subscription'
    )
    is_active = models.BooleanField(default=True)
    failure_count = models.PositiveSmallIntegerField(
        default=0,
        help_text='Consecutive webhook delivery failures'
    )
    last_success_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last successful webhook delivery'
    )
    created_date = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ['scope', 'author', 'webhook_url']
        ordering = ['-created_date']

    def __str__(self):
        target = self.author.user.username if self.author else 'GLOBAL'
        return f'[{self.scope}] {self.name or "Webhook"} -> {target}'

    def record_success(self):
        """Record a successful webhook delivery"""
        WebhookSubscriptionStateService.record_success(self)

    def record_failure(self):
        """
        Record a failed webhook delivery.
        Auto-deactivates after MAX_FAILURES consecutive failures.
        """
        WebhookSubscriptionStateService.record_failure(self)


class UsernameChangeLog(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['username']),
        ]

    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    username = models.CharField(max_length=50)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.username} -> {self.user.username}'


class SocialAuthProvider(models.Model):
    key = models.CharField(max_length=20, unique=True, choices=SUPPORTED_SOCIAL_AUTH_PROVIDER_CHOICES)
    client_id = models.CharField(max_length=255, blank=True)
    client_secret = models.TextField(blank=True)
    is_enabled = models.BooleanField(default=False)

    def clean(self):
        super().clean()
        if self.key not in SUPPORTED_SOCIAL_AUTH_PROVIDERS:
            raise ValidationError({'key': '지원하지 않는 소셜 로그인 제공자입니다.'})

    def save(self, *args, **kwargs):
        if self.client_secret:
            from board.services.social_auth_provider_secret_service import SocialAuthProviderSecretService
            self.client_secret = SocialAuthProviderSecretService.encrypt_secret(self.client_secret)
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.key


class SocialAuth(models.Model):
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'uid'],
                name='unique_social_auth_provider_uid',
            ),
        ]

    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    provider = models.ForeignKey('board.SocialAuthProvider', on_delete=models.CASCADE)
    uid = models.CharField(max_length=50)
    extra_data = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.provider.key} - {self.user.username}'


class LoginSetting(models.Model):
    """
    Site-wide login and signup settings.
    Only one instance should exist (singleton pattern).
    """
    welcome_notification_message = models.TextField(
        blank=True,
        default='',
        help_text='회원가입 시 발송될 환영 알림 메시지 ({name}을 사용하여 사용자 이름 삽입 가능)'
    )
    welcome_notification_url = models.CharField(
        max_length=255,
        blank=True,
        default='/',
        help_text='회원가입 알림 클릭 시 이동할 URL'
    )
    account_deletion_redirect_url = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text='회원 탈퇴 시 리다이렉트할 URL (비워두면 메인 페이지로 이동, 설문 링크 등을 설정할 수 있습니다)'
    )
    hcaptcha_enabled = models.BooleanField(
        default=False,
        help_text='회원가입 hCaptcha 검증 사용 여부'
    )
    hcaptcha_site_key = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='hCaptcha Site Key'
    )
    hcaptcha_secret_key = models.TextField(
        blank=True,
        default='',
        help_text='암호화 저장되는 hCaptcha Secret Key'
    )
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '🏢 [사이트 운영] 로그인 관리'
        verbose_name_plural = '🏢 [사이트 운영] 로그인 관리'

    def __str__(self):
        return 'Login Settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_instance(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class IntegrationSetting(models.Model):
    """
    Site-wide external integration settings.
    Only one instance should exist (singleton pattern).
    """
    telegram_enabled = models.BooleanField(
        default=False,
        help_text='텔레그램 봇 연동 사용 여부'
    )
    telegram_bot_username = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text='사용자에게 안내할 텔레그램 봇 사용자명'
    )
    telegram_bot_token = models.TextField(
        blank=True,
        default='',
        help_text='암호화 저장되는 텔레그램 봇 토큰'
    )
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '🏢 [사이트 운영] 텔레그램'
        verbose_name_plural = '🏢 [사이트 운영] 텔레그램'

    def __str__(self):
        return 'Integration Settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        if self.telegram_bot_token:
            self.telegram_bot_token = IntegrationSettingService.encrypt_secret(self.telegram_bot_token)
        super().save(*args, **kwargs)

    @classmethod
    def get_instance(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class SiteSetting(models.Model):
    """
    Site-wide settings for custom scripts and analytics.
    Only one instance should exist (singleton pattern).
    """
    # Custom scripts for site-wide analytics
    header_script = models.TextField(blank=True,
                                      help_text='<head> 태그 안에 삽입될 스크립트 (예: Google Analytics, Umami)')
    footer_script = models.TextField(blank=True,
                                      help_text='</body> 태그 전에 삽입될 스크립트')

    # Brand identity settings
    site_name = models.CharField(
        max_length=80,
        blank=True,
        default='BLEX',
        help_text='사이트 공식 이름'
    )
    logo_svg = models.FileField(upload_to='brand/logo/default/', blank=True)
    logo_svg_dark = models.FileField(upload_to='brand/logo/dark/', blank=True)
    icon_svg = models.FileField(upload_to='brand/icon/default/', blank=True)
    icon_svg_dark = models.FileField(upload_to='brand/icon/dark/', blank=True)
    icon_manifest = models.JSONField(blank=True, default=dict)

    # Search and agent exposure settings
    seo_enabled = models.BooleanField(
        default=True,
        help_text='검색엔진용 robots.txt 색인 허용 및 HTML noindex 신호 제어 여부'
    )
    robots_txt_extra_rules = models.TextField(
        blank=True,
        default='',
        help_text='블로그가 생성하는 robots.txt 기본 정책 뒤에 추가할 런타임 규칙'
    )
    aeo_enabled = models.BooleanField(
        default=False,
        help_text='AI 에이전트용 llms.txt, Markdown endpoint, discovery header 노출 여부'
    )

    # Metadata
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '🏢 [사이트 운영] 사이트 설정'
        verbose_name_plural = '🏢 [사이트 운영] 사이트 설정'

    def __str__(self):
        return 'Site Settings'

    def save(self, *args, **kwargs):
        # Ensure only one instance exists (singleton)
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_instance(cls):
        """Get or create the singleton instance"""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class StaticPage(models.Model):
    """
    Static pages that can be created and edited from admin panel.
    Accessible via /static/<slug>/ URLs.
    """
    slug = models.SlugField(max_length=100, unique=True, allow_unicode=True,
                            help_text='URL 경로 (예: about, privacy, terms)')
    title = models.CharField(max_length=200, help_text='페이지 제목')
    content = models.TextField(help_text='페이지 내용 (HTML 지원)')
    meta_description = models.CharField(max_length=160, blank=True,
                                        help_text='SEO용 메타 설명 (최대 160자)')

    # Display settings
    is_published = models.BooleanField(default=True, help_text='공개 여부')
    show_in_footer = models.BooleanField(default=False,
                                         help_text='푸터에 링크 표시')
    order = models.IntegerField(default=0, help_text='정렬 순서 (낮을수록 먼저)')

    # Metadata
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)
    author = models.ForeignKey('auth.User', on_delete=models.SET_NULL,
                               null=True, blank=True)

    class Meta:
        ordering = ['order', 'slug']
        verbose_name = '🏢 [사이트 운영] 정적 페이지'
        verbose_name_plural = '🏢 [사이트 운영] 정적 페이지'

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return f'/static/{self.slug}/'


class BannerType(models.TextChoices):
    """Banner type choices"""
    HORIZONTAL = 'horizontal', '줄배너 (가로 전체)'
    SIDEBAR = 'sidebar', '사이드배너 (좌우 측면)'


class BannerPosition(models.TextChoices):
    """Banner position choices"""
    TOP = 'top', '상단'
    BOTTOM = 'bottom', '하단'
    LEFT = 'left', '좌측'
    RIGHT = 'right', '우측'


class SiteContentBase(models.Model):
    scope = models.CharField(max_length=10, choices=SiteContentScope.choices)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0)
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['order', '-created_date']

    def __str__(self):
        return f'[{self.scope}] {self.title}'


class SiteNotice(SiteContentBase):
    url = models.CharField(max_length=255, blank=True, default='')

    class Meta(SiteContentBase.Meta):
        indexes = [
            models.Index(fields=['scope', 'is_active']),
            models.Index(fields=['user', 'is_active']),
        ]


class SiteBanner(SiteContentBase):
    content_html = models.TextField(blank=True, default='')
    banner_type = models.CharField(max_length=20, choices=BannerType.choices,
                                   default=BannerType.HORIZONTAL)
    position = models.CharField(max_length=10, choices=BannerPosition.choices,
                                default=BannerPosition.TOP)

    class Meta(SiteContentBase.Meta):
        indexes = [
            models.Index(fields=['scope', 'is_active', 'banner_type', 'position']),
            models.Index(fields=['user', 'is_active']),
        ]

    def clean(self):
        if self.banner_type == BannerType.HORIZONTAL:
            if self.position not in [BannerPosition.TOP, BannerPosition.BOTTOM]:
                raise ValidationError({
                    'position': '줄배너는 상단 또는 하단에만 배치할 수 있습니다.'
                })
        if self.banner_type == BannerType.SIDEBAR:
            if self.position not in [BannerPosition.LEFT, BannerPosition.RIGHT]:
                raise ValidationError({
                    'position': '사이드배너는 좌측 또는 우측에만 배치할 수 있습니다.'
                })


class AuthorInvite(models.Model):
    code = models.CharField(max_length=64, unique=True)
    note = models.CharField(max_length=120, blank=True, default='')
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='author_invites_created',
    )
    claimed_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='author_invites_claimed',
    )
    is_active = models.BooleanField(default=True)
    created_date = models.DateTimeField(default=timezone.now)
    claimed_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_date']
        indexes = [
            models.Index(fields=['code', 'is_active']),
            models.Index(fields=['claimed_by']),
        ]

    def __str__(self):
        return self.code

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
from cryptography.fernet import InvalidToken

from modules.cipher import encrypt_value, decrypt_value
from modules.hash import get_sha256
from modules.randomness import randstr
from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot
from modules.thumbnail import make_thumbnail
from board.constants.config_meta import CONFIG_TYPE, CONFIG_TYPES, CONFIG_MAP
from board.modules.time import time_since, time_stamp
from board.modules.read_time import calc_read_time


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
        if not config.value in CONFIG_TYPES:
            return None

        meta = UserConfigMeta.objects.filter(user=self.user, name=config.value)
        if meta.exists():
            meta = meta.first()

            if not meta.value == value:
                meta.value = value
                meta.save()
            return True

        UserConfigMeta(user=self.user, name=config.value, value=str(value)).save()
        return True

    def get_meta(self, config: CONFIG_TYPE):
        if not config.value in CONFIG_TYPES:
            return None

        meta = UserConfigMeta.objects.filter(user=self.user, name=config.value)
        if not meta.exists():
            return None

        meta = meta.first()
        return CONFIG_MAP[meta.name]['type'](meta.value)

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
        if hasattr(self.user, 'telegramsync'):
            tid = self.user.telegramsync.get_decrypted_tid()
            if not tid == '':
                bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
                SubTaskProcessor.process(lambda: bot.send_messages(tid, [
                    settings.SITE_URL + str(self.url),
                    self.content
                ]))

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


class GlobalNotice(models.Model):
    title = models.CharField(max_length=200, help_text='공지 제목')
    url = models.CharField(max_length=255, help_text='공지 클릭 시 이동할 URL')
    is_active = models.BooleanField(default=True, help_text='활성화 여부')
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_date']
        verbose_name = '🏢 [사이트 운영] 글로벌 공지'
        verbose_name_plural = '🏢 [사이트 운영] 글로벌 공지'

    def __str__(self):
        return self.title


class Tag(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['value']),
        ]

    value = models.CharField(max_length=50)

    def get_image(self):
        post = self.posts.filter(
            config__hide=False,
            tags__value=self.value,
            image__contains='images'
        ).order_by('-created_date').first()

        return post.image.url if post else ''

    def __str__(self):
        return str(self.value)


class Post(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['author', 'created_date']),
            models.Index(fields=['created_date']),
            models.Index(fields=['url']),
        ]

    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    series = models.ForeignKey('board.Series', related_name='posts', on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=65)
    url = models.SlugField(max_length=65, unique=True, allow_unicode=True)
    image = models.ImageField(blank=True, upload_to=title_image_path)
    read_time = models.IntegerField(default=0)
    tags = models.ManyToManyField(Tag, related_name='posts', blank=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)
    meta_description = models.CharField(max_length=250, blank=True)

    def create_unique_url(self, url=None):
        url = url if url else slugify(self.title, allow_unicode=True)

        post = Post.objects.filter(url=url)
        while post.exists():
            url = url + '-' + randstr(8)
            post = Post.objects.filter(url=url)

        self.url = url

    def get_image(self):
        if self.image:
            return self.image.url
        else:
            return settings.RESOURCE_URL + 'assets/images/default-cover-1.jpg'

    def is_published(self):
        try:
            # Handle case where created_date might not be a datetime object
            if isinstance(self.created_date, str):
                created_date = dateutil_parser.parse(self.created_date)
            else:
                created_date = self.created_date
            return created_date < timezone.now()
        except (ValueError, TypeError, AttributeError) as e:
            # If we can't parse the date, assume it's published to be safe
            return True

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
        will_make_thumbnail = False
        if not self.pk and self.image:
            will_make_thumbnail = True

        post = Post.objects.filter(id=self.id)
        if post.exists():
            post = post.first()
            if post.image != self.image:
                will_make_thumbnail = True

        super(Post, self).save(*args, **kwargs)
        if will_make_thumbnail:
            make_thumbnail(self, size=750, quality=50, thumbnail_type='preview')
            make_thumbnail(self, size=750, quality=85, thumbnail_type='minify')
            make_thumbnail(self, size=1920, quality=85)


class PostContent(models.Model):
    post = models.OneToOneField('board.Post', related_name='content', on_delete=models.CASCADE)
    text_md = models.TextField(blank=True)
    text_html = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if self.post:
            self.post.read_time = calc_read_time(self.text_html)
            self.post.save()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.post.title


class PostConfig(models.Model):
    post = models.OneToOneField('board.Post', related_name='config', on_delete=models.CASCADE)
    hide = models.BooleanField(default=False)
    notice = models.BooleanField(default=False)
    advertise = models.BooleanField(default=False)
    block_comment = models.BooleanField(default=False)

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
        EDITOR = 'EDITOR', '편집자'

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.READER,
        help_text='사용자 역할 (독자: 읽기만, 편집자: 글 작성 및 통계)'
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
        will_make_thumbnail = False
        if not self.pk and self.avatar:
            will_make_thumbnail = True

        profile = Profile.objects.filter(id=self.id)
        if profile.exists():
            profile = profile.first()
            if profile.avatar != self.avatar:
                will_make_thumbnail = True

        super(Profile, self).save(*args, **kwargs)
        if will_make_thumbnail:
            make_thumbnail(self, size=500)

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
        url = url if url else slugify(self.name, allow_unicode=True)

        series = Series.objects.filter(url=url)
        while series.exists():
            url = url + '-' + randstr(8)
            series = Series.objects.filter(url=url)

        self.url = url

    def thumbnail(self):
        post = Post.objects.filter(series=self, config__hide=False).first()
        return post.get_thumbnail() if post else ''

    def get_absolute_url(self):
        return reverse('series_detail', args=[self.owner.username, self.url])

    def time_since(self):
        return time_since(self.created_date)

    def save(self, *args, **kwargs):
        if not self.url:
            self.create_unique_url()
        self.updated_date = timezone.now()
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
        try:
            return decrypt_value(self.tid)
        except (InvalidToken, Exception):
            return ''

    def is_token_expire(self):
        one_day_ago = timezone.now() - datetime.timedelta(days=1)
        if self.created_date < one_day_ago:
            return True
        return False

    def __str__(self):
        return self.user.username
    
    def save(self, *args, **kwargs):
        if self.tid and not self._is_encrypted(self.tid):
            self.tid = encrypt_value(self.tid).decode()
        super().save(*args, **kwargs)
    
    def _is_encrypted(self, value):
        try:
            decrypt_value(value)
            return True
        except:
            return False


class TempPosts(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title = models.CharField(max_length=50)
    token = models.CharField(max_length=50)
    text_md = models.TextField(blank=True)
    tag = models.CharField(max_length=50)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def time_since(self):
        return time_since(self.created_date)

    def __str__(self):
        return self.title


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


class WebhookSubscription(models.Model):
    """
    Webhook subscription for author-based notifications.
    When an author publishes a new post, notifications are sent to all
    webhook URLs subscribed to that author.
    """
    MAX_FAILURES = 3  # Auto-deactivate after this many consecutive failures

    author = models.ForeignKey(
        'board.Profile',
        on_delete=models.CASCADE,
        related_name='webhook_subscribers',
        help_text='The author being subscribed to'
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
        unique_together = ['author', 'webhook_url']
        ordering = ['-created_date']

    def __str__(self):
        return f'{self.name or "Webhook"} -> {self.author.user.username}'

    def record_success(self):
        """Record a successful webhook delivery"""
        self.failure_count = 0
        self.last_success_date = timezone.now()
        self.save(update_fields=['failure_count', 'last_success_date'])

    def record_failure(self):
        """
        Record a failed webhook delivery.
        Auto-deactivates after MAX_FAILURES consecutive failures.
        """
        self.failure_count += 1
        if self.failure_count >= self.MAX_FAILURES:
            self.is_active = False
        self.save(update_fields=['failure_count', 'is_active'])


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
    key = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=20)
    icon = models.CharField(max_length=20)
    color = models.CharField(max_length=20)

    def __str__(self):
        return self.name


class SocialAuth(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    provider = models.ForeignKey('board.SocialAuthProvider', on_delete=models.CASCADE)
    uid = models.CharField(max_length=50)
    extra_data = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.provider.name} - {self.user.username}'


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

    # Welcome notification settings
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

    # Account deletion settings
    account_deletion_redirect_url = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text='회원 탈퇴 시 리다이렉트할 URL (비워두면 메인 페이지로 이동, 설문 링크 등을 설정할 수 있습니다)'
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
    slug = models.SlugField(max_length=100, unique=True,
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
    """Banner type choices shared by Banner and GlobalBanner"""
    HORIZONTAL = 'horizontal', '줄배너 (가로 전체)'
    SIDEBAR = 'sidebar', '사이드배너 (좌우 측면)'


class BannerPosition(models.TextChoices):
    """Banner position choices shared by Banner and GlobalBanner"""
    TOP = 'top', '상단'
    BOTTOM = 'bottom', '하단'
    LEFT = 'left', '좌측'
    RIGHT = 'right', '우측'


class Banner(models.Model):
    """
    User blog banners that can be displayed at various positions.
    Supports both horizontal (full-width) and sidebar banners.
    """
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE,
                             related_name='banners')
    title = models.CharField(max_length=100,
                             help_text='배너 이름 (관리용)')
    content_html = models.TextField(
        help_text='배너 HTML 콘텐츠 (스크립트는 자동 제거됨)')

    banner_type = models.CharField(
        max_length=20,
        choices=BannerType.choices,
        default=BannerType.HORIZONTAL,
        help_text='배너 타입'
    )

    position = models.CharField(
        max_length=10,
        choices=BannerPosition.choices,
        default=BannerPosition.TOP,
        help_text='배너 위치'
    )

    # Settings
    is_active = models.BooleanField(default=True,
                                    help_text='배너 활성화 여부')
    order = models.IntegerField(default=0,
                                help_text='표시 순서 (낮을수록 먼저)')

    # Metadata
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-created_date']
        indexes = [
            models.Index(fields=['user', 'is_active', 'banner_type', 'position']),
        ]

    def __str__(self):
        return f'{self.user.username} - {self.title}'

    def clean(self):
        """Validate banner type and position compatibility"""
        # Horizontal banners can only be top/bottom
        if self.banner_type == BannerType.HORIZONTAL:
            if self.position not in [BannerPosition.TOP, BannerPosition.BOTTOM]:
                raise ValidationError({
                    'position': '줄배너는 상단 또는 하단에만 배치할 수 있습니다.'
                })

        # Sidebar banners can only be left/right
        if self.banner_type == BannerType.SIDEBAR:
            if self.position not in [BannerPosition.LEFT, BannerPosition.RIGHT]:
                raise ValidationError({
                    'position': '사이드배너는 좌측 또는 우측에만 배치할 수 있습니다.'
                })


class GlobalBanner(models.Model):
    """
    Site-wide banners managed by administrators only.
    Displayed across all user posts regardless of author.
    No HTML sanitization applied - admin-controlled content.
    """
    title = models.CharField(max_length=100,
                             help_text='배너 이름 (관리용)')
    content_html = models.TextField(
        help_text='배너 HTML 콘텐츠 (관리자 전용 - sanitize 없음)')

    banner_type = models.CharField(
        max_length=20,
        choices=BannerType.choices,
        default=BannerType.HORIZONTAL,
        help_text='배너 타입'
    )

    position = models.CharField(
        max_length=10,
        choices=BannerPosition.choices,
        default=BannerPosition.TOP,
        help_text='배너 위치'
    )

    # Settings
    is_active = models.BooleanField(default=True,
                                    help_text='배너 활성화 여부')
    order = models.IntegerField(default=0,
                                help_text='표시 순서 (낮을수록 먼저)')

    # Metadata
    created_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL,
                                   null=True, blank=True,
                                   related_name='created_global_banners',
                                   help_text='생성한 관리자')
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-created_date']
        indexes = [
            models.Index(fields=['is_active', 'banner_type', 'position']),
        ]
        verbose_name = '🏢 [사이트 운영] 글로벌 배너'
        verbose_name_plural = '🏢 [사이트 운영] 글로벌 배너'

    def __str__(self):
        return f'[전역] {self.title}'

    def clean(self):
        """Validate banner type and position compatibility"""
        # Horizontal banners can only be top/bottom
        if self.banner_type == BannerType.HORIZONTAL:
            if self.position not in [BannerPosition.TOP, BannerPosition.BOTTOM]:
                raise ValidationError({
                    'position': '줄배너는 상단 또는 하단에만 배치할 수 있습니다.'
                })

        # Sidebar banners can only be left/right
        if self.banner_type == BannerType.SIDEBAR:
            if self.position not in [BannerPosition.LEFT, BannerPosition.RIGHT]:
                raise ValidationError({
                    'position': '사이드배너는 좌측 또는 우측에만 배치할 수 있습니다.'
                })

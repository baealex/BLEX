import datetime

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from modules.hash import get_sha256

from board.modules.time import time_since
from board.services.integration_setting_service import IntegrationSettingService
from board.services.notification_delivery_service import NotificationDeliveryService
from board.services.telegram_sync_encryption_service import TelegramSyncEncryptionService
from board.services.webhook_subscription_state_service import WebhookSubscriptionStateService


class Notify(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    key = models.CharField(max_length=44, unique=True)
    url = models.CharField(max_length=255)
    content = models.TextField()
    has_read = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = _('Notification')
        verbose_name_plural = _('Notifications')

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


class TelegramSync(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    tid = models.CharField(max_length=200, blank=True) # encrypted
    auth_token = models.CharField(max_length=8, blank=True)
    auth_token_exp = models.DateTimeField(default=timezone.now)
    created_date = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = _('Telegram connection')
        verbose_name_plural = _('Telegram connections')

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
        verbose_name = _('Webhook subscription')
        verbose_name_plural = _('Webhook subscriptions')
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

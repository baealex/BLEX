import datetime

import pyotp
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.urls import reverse
from django.utils import timezone

from board.constants.config_meta import CONFIG_TYPE
from board.constants.social_auth import (
    SUPPORTED_SOCIAL_AUTH_PROVIDERS,
    SUPPORTED_SOCIAL_AUTH_PROVIDER_CHOICES,
)
from board.services.profile_image_service import ProfileImageService
from board.services.two_factor_auth_secret_service import TwoFactorAuthSecretService
from board.services.user_config_meta_service import UserConfigMetaService

from .helpers import avatar_path, cover_path
from .posts import Post


class EmailChange(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    email = models.CharField(max_length=255)
    auth_token = models.CharField(max_length=8, blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = '이메일 변경 요청'
        verbose_name_plural = '이메일 변경 요청'

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

    class Meta:
        verbose_name = '사용자 기능 설정'
        verbose_name_plural = '사용자 기능 설정'

    def __str__(self):
        return self.user.username


class Config(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)

    class Meta:
        verbose_name = '사용자 설정'
        verbose_name_plural = '사용자 설정'

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


class UserLinkMeta(models.Model):
    order = models.IntegerField(default=0)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = '사용자 링크'
        verbose_name_plural = '사용자 링크'

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

    class Meta:
        verbose_name = '프로필'
        verbose_name_plural = '프로필'

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


class TwoFactorAuth(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    recovery_key = models.CharField(max_length=64, blank=True)
    totp_secret = models.TextField(blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = '2단계 인증'
        verbose_name_plural = '2단계 인증'

    def has_been_a_day(self):
        one_day_ago = timezone.now() - datetime.timedelta(days=1)
        if self.created_date < one_day_ago:
            return True
        return False

    def get_totp_secret(self):
        return TwoFactorAuthSecretService.decrypt_totp_secret(self.totp_secret)

    def verify_recovery_key(self, token):
        return TwoFactorAuthSecretService.verify_recovery_key(self.recovery_key, token)

    def verify_totp(self, token):
        """Verify TOTP token"""
        totp_secret = self.get_totp_secret()
        if not totp_secret:
            return False
        try:
            totp = pyotp.TOTP(totp_secret)
            return totp.verify(token, valid_window=1)  # Allow 30s window on each side
        except Exception:
            return False

    def get_provisioning_uri(self):
        """Get provisioning URI for QR code"""
        totp_secret = self.get_totp_secret()
        if not totp_secret:
            return None
        totp = pyotp.TOTP(totp_secret)
        return totp.provisioning_uri(
            name=self.user.email,
            issuer_name='BLEX'
        )

    def save(self, *args, **kwargs):
        TwoFactorAuthSecretService.prepare_for_save(self)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.user.username


class UsernameChangeLog(models.Model):
    class Meta:
        verbose_name = '사용자명 변경 이력'
        verbose_name_plural = '사용자명 변경 이력'
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
        verbose_name = '소셜 로그인 연동'
        verbose_name_plural = '소셜 로그인 연동'
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

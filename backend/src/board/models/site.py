from django.core.exceptions import ValidationError
from django.db import models

from .integrations import SiteContentScope


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

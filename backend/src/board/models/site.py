from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _, pgettext_lazy

from .integrations import SiteContentScope


class SiteSetting(models.Model):
    """
    Site-wide settings for custom scripts and analytics.
    Only one instance should exist (singleton pattern).
    """
    # Custom scripts for site-wide analytics
    header_script = models.TextField(
        blank=True,
        help_text=_(
            'Script inserted inside the <head> element (for example, Google '
            'Analytics or Umami).'
        ),
    )
    footer_script = models.TextField(
        blank=True,
        help_text=_('Script inserted before the closing </body> tag.'),
    )

    # Brand identity settings
    site_name = models.CharField(
        max_length=80,
        blank=True,
        default='BLEX',
        help_text=_('Official site name.'),
    )
    logo_svg = models.FileField(upload_to='brand/logo/default/', blank=True)
    logo_svg_dark = models.FileField(upload_to='brand/logo/dark/', blank=True)
    icon_svg = models.FileField(upload_to='brand/icon/default/', blank=True)
    icon_svg_dark = models.FileField(upload_to='brand/icon/dark/', blank=True)
    icon_manifest = models.JSONField(blank=True, default=dict)

    # Search and agent exposure settings
    seo_enabled = models.BooleanField(
        default=True,
        help_text=_(
            'Allow search-engine indexing through robots.txt and HTML '
            'noindex signals.'
        ),
    )
    robots_txt_extra_rules = models.TextField(
        blank=True,
        default='',
        help_text=_(
            "Additional runtime rules appended after the blog's default "
            'robots.txt policy.'
        ),
    )
    aeo_enabled = models.BooleanField(
        default=False,
        help_text=_(
            'Expose llms.txt, Markdown endpoints, and discovery headers for '
            'AI agents.'
        ),
    )

    # Metadata
    updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('🏢 [Site operations] Site settings')
        verbose_name_plural = _('🏢 [Site operations] Site settings')

    def __str__(self):
        return str(_('Site settings'))

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
    slug = models.SlugField(
        max_length=100,
        unique=True,
        allow_unicode=True,
        help_text=_('URL path (for example, about, privacy, or terms).'),
    )
    title = models.CharField(max_length=200, help_text=_('Page title.'))
    content = models.TextField(help_text=_('Page content. HTML is supported.'))
    meta_description = models.CharField(
        max_length=160,
        blank=True,
        help_text=_('SEO meta description (up to 160 characters).'),
    )

    # Display settings
    is_published = models.BooleanField(
        default=True,
        help_text=_('Whether the page is public.'),
    )
    show_in_footer = models.BooleanField(
        default=False,
        help_text=_('Show a link in the footer.'),
    )
    order = models.IntegerField(
        default=0,
        help_text=_('Sort order. Lower numbers appear first.'),
    )

    # Metadata
    created_date = models.DateTimeField(auto_now_add=True)
    updated_date = models.DateTimeField(auto_now=True)
    author = models.ForeignKey('auth.User', on_delete=models.SET_NULL,
                               null=True, blank=True)

    class Meta:
        ordering = ['order', 'slug']
        verbose_name = _('🏢 [Site operations] Static pages')
        verbose_name_plural = _('🏢 [Site operations] Static pages')

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return f'/static/{self.slug}/'


class BannerType(models.TextChoices):
    """Banner type choices"""
    HORIZONTAL = 'horizontal', pgettext_lazy(
        'Banner type',
        'Full-width banner (horizontal)',
    )
    SIDEBAR = 'sidebar', pgettext_lazy(
        'Banner type',
        'Side banner (left/right)',
    )


class BannerPosition(models.TextChoices):
    """Banner position choices"""
    TOP = 'top', pgettext_lazy('Banner position', 'Top')
    BOTTOM = 'bottom', pgettext_lazy('Banner position', 'Bottom')
    LEFT = 'left', pgettext_lazy('Banner position', 'Left')
    RIGHT = 'right', pgettext_lazy('Banner position', 'Right')


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
        verbose_name = _('Site notice')
        verbose_name_plural = _('Site notices')
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
        verbose_name = _('Site banner')
        verbose_name_plural = _('Site banners')
        indexes = [
            models.Index(fields=['scope', 'is_active', 'banner_type', 'position']),
            models.Index(fields=['user', 'is_active']),
        ]

    def clean(self):
        if self.banner_type == BannerType.HORIZONTAL:
            if self.position not in [BannerPosition.TOP, BannerPosition.BOTTOM]:
                raise ValidationError({
                    'position': _(
                        'Full-width banners can only be placed at the top or '
                        'bottom.'
                    )
                })
        if self.banner_type == BannerType.SIDEBAR:
            if self.position not in [BannerPosition.LEFT, BannerPosition.RIGHT]:
                raise ValidationError({
                    'position': _(
                        'Side banners can only be placed on the left or right.'
                    )
                })

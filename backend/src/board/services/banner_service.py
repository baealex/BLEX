"""
Banner Service
Handles business logic for both user banners and global banners
"""
from typing import List, Dict
from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Q
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.safestring import SafeString, mark_safe
from django.utils.translation import pgettext

from board.html_utils import safe_navigation_url, sanitize_html
from board.models import SiteBanner, SiteContentScope
from board.models.site import TEMPLATE_BANNER_TYPES, BannerTemplate


class BannerService:
    """Service for managing and displaying banners"""

    TEMPLATE_PATHS = {
        BannerTemplate.NOTICE: 'components/banners/notice.html',
        BannerTemplate.CARD: 'components/banners/card.html',
        BannerTemplate.CALLOUT: 'components/banners/callout.html',
        BannerTemplate.IMAGE: 'components/banners/image.html',
        BannerTemplate.PROFILE: 'components/banners/profile.html',
    }

    # Gallery thumbnails show where an uploaded image goes; the editor never prefills it.
    SAMPLE_IMAGE_PATH = 'assets/images/default-cover-2.jpg'

    @staticmethod
    def render_banner_html(banner: SiteBanner, author: User | None = None) -> SafeString:
        """Render a banner for post pages and the settings preview with the same rules.

        ``author`` is the post author; the profile template shows their avatar.
        """
        template_path = BannerService.TEMPLATE_PATHS.get(banner.template)
        if template_path is None:
            if banner.scope == SiteContentScope.USER:
                return mark_safe(sanitize_html(banner.content_html))
            return mark_safe(banner.content_html)

        author_avatar_url = ''
        if banner.template == BannerTemplate.PROFILE and author is not None:
            profile = getattr(author, 'profile', None)
            author_avatar_url = profile.get_thumbnail() if profile else ''

        data = banner.template_values
        image_url = safe_navigation_url(data['image_url'])
        return render_to_string(template_path, {
            'banner': banner,
            'data': data,
            'link_url': safe_navigation_url(data['link_url']),
            'image_url': image_url,
            'image_layout': data['image_layout'] if image_url else '',
            'author_avatar_url': author_avatar_url,
        })

    @staticmethod
    def get_template_samples(user: User) -> Dict[str, Dict[str, str]]:
        """Starter text the editor fills in when a template is chosen."""
        # Keep starter text generic: it must not promise features or facts the author may not have.
        learn_more = pgettext('Banner link label', 'Learn more')
        visit_blog = pgettext('Banner sample', 'Visit the blog')
        return {
            BannerTemplate.NOTICE: {
                'eyebrow': pgettext('Banner sample', 'Notice'),
                'headline': pgettext('Banner sample', "There's some news to share."),
                'description': '',
                'link_label': learn_more,
            },
            BannerTemplate.CARD: {
                'eyebrow': '',
                'headline': pgettext('Banner sample', 'Did this post help you?'),
                'description': pgettext('Banner sample', 'Read the other posts too.'),
                'link_label': visit_blog,
            },
            BannerTemplate.CALLOUT: {
                'eyebrow': '',
                'headline': pgettext('Banner sample', 'Before you read'),
                'description': pgettext(
                    'Banner sample',
                    'This post reflects the time it was written and may be out of date.',
                ),
                'link_label': learn_more,
            },
            BannerTemplate.IMAGE: {
                # Alt text has to describe the actual image, so the author writes it.
                'eyebrow': '',
                'headline': '',
                'description': '',
                'link_label': '',
            },
            BannerTemplate.PROFILE: {
                'eyebrow': '',
                'headline': user.username,
                'description': pgettext('Banner sample', 'Thanks for stopping by.'),
                'link_label': visit_blog,
            },
        }

    @staticmethod
    def build_template_gallery(scope: str, user: User) -> List[Dict]:
        """Render every template with starter text so the editor can show real thumbnails."""
        sample_link = reverse('user_profile', args=[user.username])
        sample_image = settings.RESOURCE_URL + BannerService.SAMPLE_IMAGE_PATH
        gallery = []
        for template, sample in BannerService.get_template_samples(user).items():
            banner_types = TEMPLATE_BANNER_TYPES[template]
            banner = SiteBanner(
                scope=scope,
                user=user,
                template=template,
                banner_type=banner_types[0],
                template_data={
                    **sample,
                    'link_url': sample_link,
                    'image_url': (
                        sample_image
                        if template in (BannerTemplate.CARD, BannerTemplate.IMAGE)
                        else ''
                    ),
                },
            )
            gallery.append({
                'template': str(template),
                'banner_types': [str(banner_type) for banner_type in banner_types],
                'sample': {**sample, 'link_url': sample_link},
                'html': BannerService.render_banner_html(banner, author=user),
            })
        return gallery

    @staticmethod
    def get_combined_banners_for_position(
        author: User,
        banner_type: str,
        position: str
    ) -> List[SiteBanner]:
        """
        Combine user banners and global banners for a specific position.

        Args:
            author: The post author (User instance)
            banner_type: Banner type ('horizontal' or 'sidebar')
            position: Banner position ('top', 'bottom', 'left', 'right')

        Returns:
            List of combined banners sorted by order and created_date
        """
        banners = list(
            SiteBanner.objects.filter(
                is_active=True,
                banner_type=banner_type,
                position=position,
            ).filter(
                Q(scope=SiteContentScope.GLOBAL) |
                Q(scope=SiteContentScope.USER, user=author)
            ).select_related('user').order_by('order', '-created_date')
        )
        for banner in banners:
            if banner.scope == SiteContentScope.USER:
                banner.content_html = sanitize_html(banner.content_html)
        return banners

    @staticmethod
    def get_all_banners_for_author(author: User) -> Dict[str, List[SiteBanner]]:
        """
        Get all active banners for a post author, including global banners.

        Args:
            author: The post author (User instance)

        Returns:
            Dictionary with banner positions as keys:
            {
                'top': [banner1, banner2, ...],
                'bottom': [...],
                'left': [...],
                'right': [...]
            }
        """
        banners = SiteBanner.objects.filter(
            is_active=True,
        ).filter(
            Q(scope=SiteContentScope.GLOBAL) |
            Q(scope=SiteContentScope.USER, user=author)
        ).select_related('user').order_by('order', '-created_date')

        result = {
            'top': [],
            'bottom': [],
            'left': [],
            'right': []
        }

        for banner in banners:
            if banner.position in result:
                banner.rendered_html = BannerService.render_banner_html(banner, author=author)
                result[banner.position].append(banner)

        return result

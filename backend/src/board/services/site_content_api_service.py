from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.utils.translation import gettext

from board.html_utils import safe_navigation_url, sanitize_html
from board.models import (
    BannerPosition,
    BannerType,
    SiteBanner,
    SiteContentScope,
    SiteNotice,
    StaticPage,
)
from board.models.site import (
    BANNER_TYPE_IMAGE_LAYOUTS,
    TEMPLATE_BANNER_TYPES,
    TEMPLATE_DATA_CHOICES,
    TEMPLATE_DATA_DEFAULTS,
    TEMPLATE_DATA_TEXT_LIMITS,
    BannerImageLayout,
    BannerTemplate,
    normalize_template_data,
)
from board.modules.response import ErrorCode
from board.services.banner_service import BannerService


class SiteContentApiError(Exception):
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class SiteContentApiService:
    NOTICE_LIST_FIELDS = (
        'id',
        'title',
        'url',
        'is_active',
        'created_date',
        'updated_date',
    )
    BANNER_LIST_FIELDS = (
        'id',
        'title',
        'content_html',
        'banner_type',
        'position',
        'template',
        'template_data',
        'is_active',
        'order',
        'created_date',
        'updated_date',
    )
    BANNER_EDITABLE_FIELDS = (
        'title',
        'content_html',
        'banner_type',
        'position',
        'template',
        'is_active',
        'order',
    )
    STATIC_PAGE_FIELDS = (
        'id',
        'title',
        'slug',
        'content',
        'meta_description',
        'is_published',
        'show_in_footer',
        'order',
        'created_date',
        'updated_date',
    )

    @staticmethod
    def scoped_notice_queryset(scope: str, user: User | None = None) -> QuerySet[SiteNotice]:
        queryset = SiteNotice.objects.filter(scope=scope)
        if scope == SiteContentScope.USER:
            queryset = queryset.filter(user=user)
        return queryset

    @staticmethod
    def scoped_banner_queryset(scope: str, user: User | None = None) -> QuerySet[SiteBanner]:
        queryset = SiteBanner.objects.filter(scope=scope)
        if scope == SiteContentScope.USER:
            queryset = queryset.filter(user=user)
        return queryset

    @staticmethod
    def serialize_notice(notice: SiteNotice) -> dict:
        return {
            'id': notice.id,
            'title': notice.title,
            'url': safe_navigation_url(notice.url),
            'is_active': notice.is_active,
            'created_date': notice.created_date.isoformat(),
            'updated_date': notice.updated_date.isoformat(),
        }

    @staticmethod
    def serialize_notice_list(queryset: QuerySet[SiteNotice]) -> list[dict]:
        """Serialize a notice list without loading unused ownership and scope fields."""
        return [
            {
                **notice,
                'url': safe_navigation_url(notice['url']),
                'created_date': notice['created_date'].isoformat(),
                'updated_date': notice['updated_date'].isoformat(),
            }
            for notice in queryset.values(*SiteContentApiService.NOTICE_LIST_FIELDS)
        ]

    @staticmethod
    def serialize_banner(
        banner: SiteBanner,
        *,
        include_created_by: bool = False,
        sanitize_content: bool = False,
    ) -> dict:
        data = {
            'id': banner.id,
            'title': banner.title,
            'content_html': (
                sanitize_html(banner.content_html)
                if sanitize_content
                else banner.content_html
            ),
            'banner_type': banner.banner_type,
            'position': banner.position,
            'template': banner.template,
            **SiteContentApiService.serialize_template_values(banner.template_values),
            'is_active': banner.is_active,
            'order': banner.order,
            'created_date': banner.created_date.isoformat(),
            'updated_date': banner.updated_date.isoformat(),
        }
        if include_created_by:
            data['created_by'] = banner.user.username if banner.user else None
        return data

    @staticmethod
    def serialize_banner_list(
        queryset: QuerySet[SiteBanner],
        *,
        include_created_by: bool = False,
        sanitize_content: bool = False,
    ) -> list[dict]:
        """Serialize banners with one lean values query, including only creator username."""
        fields = SiteContentApiService.BANNER_LIST_FIELDS
        if include_created_by:
            fields = (*fields, 'user__username')

        result = []
        for banner in queryset.values(*fields):
            banner['created_date'] = banner['created_date'].isoformat()
            banner['updated_date'] = banner['updated_date'].isoformat()
            banner.update(SiteContentApiService.serialize_template_values(
                normalize_template_data(banner.pop('template_data')),
            ))
            if sanitize_content:
                banner['content_html'] = sanitize_html(banner['content_html'])
            if include_created_by:
                banner['created_by'] = banner.pop('user__username')
            result.append(banner)
        return result

    @staticmethod
    def serialize_template_values(values: dict) -> dict:
        """Template data goes out as flat banner fields, with links that are safe to follow."""
        return {
            **values,
            'link_url': safe_navigation_url(values['link_url']),
            'image_url': safe_navigation_url(values['image_url']),
        }

    @staticmethod
    def serialize_static_page(page: StaticPage) -> dict:
        return {
            'id': page.id,
            'title': page.title,
            'slug': page.slug,
            'content': page.content,
            'meta_description': page.meta_description,
            'is_published': page.is_published,
            'show_in_footer': page.show_in_footer,
            'order': page.order,
            'created_date': page.created_date.isoformat(),
            'updated_date': page.updated_date.isoformat(),
        }

    @staticmethod
    def validate_notice_payload(data: dict) -> None:
        if not data.get('title', ''):
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('Enter a notice title.'),
            )
        if not data.get('url', ''):
            raise SiteContentApiError(ErrorCode.VALIDATE, gettext('Enter a URL.'))

    @staticmethod
    def validate_banner_payload(data: dict) -> None:
        if not data.get('title', ''):
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('Enter a banner name.'),
            )
        template = data.get('template', BannerTemplate.HTML)
        if template == BannerTemplate.HTML and not data.get('content_html', ''):
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('Enter banner HTML.'),
            )
        SiteContentApiService.validate_banner_position(
            data.get('banner_type', BannerType.HORIZONTAL),
            data.get('position', BannerPosition.TOP),
        )

    @staticmethod
    def validate_banner_position(banner_type: str, position: str) -> None:
        if banner_type == BannerType.HORIZONTAL and position not in {
            BannerPosition.TOP,
            BannerPosition.BOTTOM,
        }:
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('Horizontal banners can only be placed at the top or bottom.'),
            )

        if banner_type == BannerType.SIDEBAR and position not in {
            BannerPosition.LEFT,
            BannerPosition.RIGHT,
        }:
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('Sidebar banners can only be placed on the left or right.'),
            )

    @staticmethod
    def validate_banner_template(banner: SiteBanner, *, preview: bool = False) -> None:
        if banner.template not in BannerTemplate.values:
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('Choose a valid banner template.'),
            )
        values = banner.template_values
        if any(values[key] not in choices.values for key, choices in TEMPLATE_DATA_CHOICES.items()):
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('Choose a valid banner style.'),
            )

        allowed_banner_types = TEMPLATE_BANNER_TYPES.get(banner.template)
        if allowed_banner_types is None:
            return

        if banner.banner_type not in allowed_banner_types:
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('This template is not available in the selected position.'),
            )
        if values['image_layout'] not in BANNER_TYPE_IMAGE_LAYOUTS[banner.banner_type]:
            # The sidebar is too narrow for a side-by-side image, so it stacks on top.
            values['image_layout'] = BannerImageLayout.TOP.value
            banner.template_data = values
        if not preview and not values['headline']:
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('Enter the banner text.'),
            )

        length_messages = {
            'eyebrow': gettext('Label must be %(limit)d characters or fewer.'),
            'headline': gettext('Banner text must be %(limit)d characters or fewer.'),
            'description': gettext('Description must be %(limit)d characters or fewer.'),
            'link_label': gettext('Button text must be %(limit)d characters or fewer.'),
            'link_url': gettext('Link must be %(limit)d characters or fewer.'),
            'image_url': gettext('Image link must be %(limit)d characters or fewer.'),
        }
        for field, message in length_messages.items():
            limit = TEMPLATE_DATA_TEXT_LIMITS[field]
            if len(values[field]) > limit:
                raise SiteContentApiError(ErrorCode.VALIDATE, message % {'limit': limit})

        if preview:
            return

        if values['link_url'] and not safe_navigation_url(values['link_url']):
            raise SiteContentApiError(
                ErrorCode.VALIDATE,
                gettext('Enter a link that starts with https://, http://, or /.'),
            )
        if banner.template == BannerTemplate.IMAGE:
            if not values['image_url']:
                raise SiteContentApiError(
                    ErrorCode.VALIDATE,
                    gettext('Upload a banner image.'),
                )
            if not safe_navigation_url(values['image_url']):
                raise SiteContentApiError(
                    ErrorCode.VALIDATE,
                    gettext('Use an uploaded image or an image link that starts with https://.'),
                )

    @staticmethod
    def apply_banner_data(banner: SiteBanner, data: dict, *, sanitize_content: bool) -> None:
        for field in SiteContentApiService.BANNER_EDITABLE_FIELDS:
            if field not in data:
                continue

            value = data[field]
            if field == 'content_html' and sanitize_content:
                value = sanitize_html(value)
            setattr(banner, field, value)

        # The API keeps template data as flat fields; they are stored together in one JSON column.
        submitted = {key: data[key] for key in TEMPLATE_DATA_DEFAULTS if key in data}
        if submitted:
            values = banner.template_values
            for key, value in submitted.items():
                values[key] = str(value or '').strip()
            banner.template_data = values

    @staticmethod
    def create_notice(scope: str, user: User | None, data: dict) -> SiteNotice:
        SiteContentApiService.validate_notice_payload(data)
        return SiteNotice.objects.create(
            scope=scope,
            user=user if scope == SiteContentScope.USER else None,
            title=data.get('title', ''),
            url=data.get('url', ''),
            is_active=data.get('is_active', True),
        )

    @staticmethod
    def update_notice(notice: SiteNotice, data: dict) -> SiteNotice:
        for field in ('title', 'url', 'is_active'):
            if field in data:
                setattr(notice, field, data[field])
        notice.save()
        return notice

    @staticmethod
    def create_banner(
        scope: str,
        user: User | None,
        data: dict,
        *,
        sanitize_content: bool,
    ) -> SiteBanner:
        SiteContentApiService.validate_banner_payload(data)
        banner = SiteBanner(scope=scope, user=user)
        SiteContentApiService.apply_banner_data(
            banner,
            data,
            sanitize_content=sanitize_content,
        )
        SiteContentApiService.validate_banner_template(banner)
        banner.save()
        return banner

    @staticmethod
    def update_banner(
        banner: SiteBanner,
        data: dict,
        *,
        sanitize_content: bool,
    ) -> SiteBanner:
        SiteContentApiService.apply_banner_data(
            banner,
            data,
            sanitize_content=sanitize_content,
        )
        SiteContentApiService.validate_banner_position(banner.banner_type, banner.position)
        SiteContentApiService.validate_banner_template(banner)
        banner.save()
        return banner

    @staticmethod
    def render_banner_preview(scope: str, user: User | None, data: dict) -> str:
        """Render unsaved banner input exactly as post pages will display it."""
        banner = SiteBanner(scope=scope, user=user)
        SiteContentApiService.apply_banner_data(banner, data, sanitize_content=False)
        SiteContentApiService.validate_banner_position(banner.banner_type, banner.position)
        SiteContentApiService.validate_banner_template(banner, preview=True)
        return BannerService.render_banner_html(banner, author=user)

    @staticmethod
    def update_banner_order(scope: str, user: User | None, order_list: list) -> None:
        queryset = SiteContentApiService.scoped_banner_queryset(scope, user)
        for item in order_list:
            if len(item) != 2:
                continue

            banner_id, order = item
            try:
                banner = queryset.get(id=banner_id)
            except SiteBanner.DoesNotExist:
                continue

            banner.order = order
            banner.save()

    @staticmethod
    def validate_static_page_payload(data: dict) -> None:
        if not data.get('title', ''):
            raise SiteContentApiError(ErrorCode.VALIDATE, gettext('Enter a title.'))
        if not data.get('slug', ''):
            raise SiteContentApiError(ErrorCode.VALIDATE, gettext('Enter a URL slug.'))

    @staticmethod
    def create_static_page(user: User, data: dict) -> StaticPage:
        SiteContentApiService.validate_static_page_payload(data)
        slug = data.get('slug', '')
        if StaticPage.objects.filter(slug=slug).exists():
            raise SiteContentApiError(
                ErrorCode.ALREADY_EXISTS,
                gettext('This slug is already in use.'),
            )

        return StaticPage.objects.create(
            title=data.get('title', ''),
            slug=slug,
            content=data.get('content', ''),
            meta_description=data.get('meta_description', ''),
            is_published=data.get('is_published', True),
            show_in_footer=data.get('show_in_footer', False),
            order=data.get('order', 0),
            author=user,
        )

    @staticmethod
    def update_static_page(page: StaticPage, data: dict) -> StaticPage:
        if 'title' in data:
            page.title = data['title']

        if 'slug' in data:
            new_slug = data['slug']
            if new_slug != page.slug and StaticPage.objects.filter(slug=new_slug).exists():
                raise SiteContentApiError(
                    ErrorCode.ALREADY_EXISTS,
                    gettext('This slug is already in use.'),
                )
            page.slug = new_slug

        for field in (
            'content',
            'meta_description',
            'is_published',
            'show_in_footer',
            'order',
        ):
            if field in data:
                setattr(page, field, data[field])

        page.save()
        return page

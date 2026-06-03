from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import QuerySet

from board.html_utils import sanitize_html
from board.models import (
    BannerPosition,
    BannerType,
    SiteBanner,
    SiteContentScope,
    SiteNotice,
    StaticPage,
)
from board.modules.response import ErrorCode


class SiteContentApiError(Exception):
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class SiteContentApiService:
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
            'url': notice.url,
            'is_active': notice.is_active,
            'created_date': notice.created_date.isoformat(),
            'updated_date': notice.updated_date.isoformat(),
        }

    @staticmethod
    def serialize_banner(banner: SiteBanner, *, include_created_by: bool = False) -> dict:
        data = {
            'id': banner.id,
            'title': banner.title,
            'content_html': banner.content_html,
            'banner_type': banner.banner_type,
            'position': banner.position,
            'is_active': banner.is_active,
            'order': banner.order,
            'created_date': banner.created_date.isoformat(),
            'updated_date': banner.updated_date.isoformat(),
        }
        if include_created_by:
            data['created_by'] = banner.user.username if banner.user else None
        return data

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
            raise SiteContentApiError(ErrorCode.VALIDATE, '공지 제목을 입력해주세요.')
        if not data.get('url', ''):
            raise SiteContentApiError(ErrorCode.VALIDATE, 'URL을 입력해주세요.')

    @staticmethod
    def validate_banner_payload(data: dict) -> None:
        if not data.get('title', ''):
            raise SiteContentApiError(ErrorCode.VALIDATE, '배너 이름을 입력해주세요.')
        if not data.get('content_html', ''):
            raise SiteContentApiError(ErrorCode.VALIDATE, '배너 내용을 입력해주세요.')
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
            raise SiteContentApiError(ErrorCode.VALIDATE, '줄배너는 상단 또는 하단에만 배치할 수 있습니다.')

        if banner_type == BannerType.SIDEBAR and position not in {
            BannerPosition.LEFT,
            BannerPosition.RIGHT,
        }:
            raise SiteContentApiError(ErrorCode.VALIDATE, '사이드배너는 좌측 또는 우측에만 배치할 수 있습니다.')

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
        content_html = data.get('content_html', '')
        if sanitize_content:
            content_html = sanitize_html(content_html)

        return SiteBanner.objects.create(
            scope=scope,
            user=user,
            title=data.get('title', ''),
            content_html=content_html,
            banner_type=data.get('banner_type', BannerType.HORIZONTAL),
            position=data.get('position', BannerPosition.TOP),
            is_active=data.get('is_active', True),
            order=data.get('order', 0),
        )

    @staticmethod
    def update_banner(
        banner: SiteBanner,
        data: dict,
        *,
        sanitize_content: bool,
    ) -> SiteBanner:
        if 'title' in data:
            banner.title = data['title']
        if 'content_html' in data:
            content_html = data['content_html']
            banner.content_html = sanitize_html(content_html) if sanitize_content else content_html
        if 'banner_type' in data:
            banner.banner_type = data['banner_type']
        if 'position' in data:
            banner.position = data['position']
        if 'is_active' in data:
            banner.is_active = data['is_active']
        if 'order' in data:
            banner.order = data['order']

        SiteContentApiService.validate_banner_position(banner.banner_type, banner.position)
        banner.save()
        return banner

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
            raise SiteContentApiError(ErrorCode.VALIDATE, '제목을 입력해주세요.')
        if not data.get('slug', ''):
            raise SiteContentApiError(ErrorCode.VALIDATE, 'URL 슬러그를 입력해주세요.')

    @staticmethod
    def create_static_page(user: User, data: dict) -> StaticPage:
        SiteContentApiService.validate_static_page_payload(data)
        slug = data.get('slug', '')
        if StaticPage.objects.filter(slug=slug).exists():
            raise SiteContentApiError(ErrorCode.ALREADY_EXISTS, '이미 사용 중인 슬러그입니다.')

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
                raise SiteContentApiError(ErrorCode.ALREADY_EXISTS, '이미 사용 중인 슬러그입니다.')
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

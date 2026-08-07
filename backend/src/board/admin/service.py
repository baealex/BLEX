"""
Admin Display & Link Service
재사용 가능한 display 및 링크 생성 로직
"""
from typing import Optional, Any
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe, SafeString
from django.utils.translation import gettext_lazy as _
from django.utils.translation import pgettext_lazy
from django.db.models import QuerySet

from board.models import Profile
from .constants import (
    AVATAR_SIZE, COVER_MAX_WIDTH, MAX_TAGS_DISPLAY,
    DATETIME_FORMAT_SHORT, COLOR_PRIMARY, COLOR_MUTED,
    COLOR_TEXT, COLOR_BG, COLOR_DARKENED_BG, COLOR_BORDER,
    COLOR_DANGER, COLOR_SUCCESS, COLOR_WARNING, COLOR_INFO
)


class AdminLinkService:
    """Admin 링크 생성 서비스"""

    @staticmethod
    def create_user_link(user: Optional[Any]) -> SafeString:
        """사용자 관리 페이지 링크 생성"""
        if not user:
            return format_html('<span style="color: {};">-</span>', COLOR_MUTED)

        try:
            url = reverse('admin:auth_user_change', args=[user.pk])
            return format_html(
                '<a href="{}" style="color: {}; text-decoration: none; font-weight: 500;">{}</a>',
                url, COLOR_PRIMARY, user.username
            )
        except Exception:
            return format_html('<span style="color: {};">Error</span>', COLOR_MUTED)

    @staticmethod
    def create_post_link(post: Optional[Any]) -> SafeString:
        """포스트 관리 페이지 링크 생성"""
        if not post:
            return format_html('<span style="color: {};">-</span>', COLOR_MUTED)

        try:
            url = reverse('admin:board_post_change', args=[post.pk])
            return format_html(
                '<a href="{}" style="color: {}; text-decoration: none;">{}</a>',
                url, COLOR_PRIMARY, post.title
            )
        except Exception:
            return format_html('<span style="color: {};">Error</span>', COLOR_MUTED)

    @staticmethod
    def create_series_link(series: Optional[Any]) -> SafeString:
        """시리즈 관리 페이지 링크 생성"""
        if not series:
            return format_html('<span style="color: {};">-</span>', COLOR_MUTED)

        try:
            url = reverse('admin:board_series_change', args=[series.pk])
            return format_html(
                '<a href="{}" style="color: {}; text-decoration: none;">{}</a>',
                url, COLOR_PRIMARY, series.name
            )
        except Exception:
            return format_html('<span style="color: {};">Error</span>', COLOR_MUTED)

    @staticmethod
    def create_external_link(
        url: Optional[str],
        text: Optional[str] = None,
    ) -> SafeString:
        """외부 링크 생성"""
        if not url:
            return format_html('<span style="color: {};">-</span>', COLOR_MUTED)

        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer" style="color: {}; text-decoration: none;">{}</a>',
            url,
            COLOR_PRIMARY,
            text if text is not None else _('Link'),
        )


class AdminDisplayService:
    """Admin display 컴포넌트 생성 서비스"""

    @staticmethod
    def role_badge(role: str, profile_model: Optional[Any] = None) -> SafeString:
        """역할 뱃지 생성 (관리자/작가/독자)"""
        badge_configs = {
            Profile.Role.EDITOR: (
                COLOR_SUCCESS,
                pgettext_lazy('Admin user role', 'Author'),
            ),
            Profile.Role.READER: (
                COLOR_MUTED,
                pgettext_lazy('Admin user role', 'Reader'),
            ),
        }

        color, text = badge_configs.get(
            role,
            (
                COLOR_MUTED,
                pgettext_lazy('Admin user role', 'Reader'),
            ),
        )

        return format_html(
            '<span style="background: {}; color: {}; padding: 4px 10px; '
            'border-radius: 4px; font-size: 12px; font-weight: 600;">{}</span>',
            color, COLOR_BG, text
        )

    @staticmethod
    def boolean_badge(
        value: bool,
        true_text: Optional[str] = None,
        false_text: Optional[str] = None,
        true_color: str = None,
        false_color: str = None
    ) -> SafeString:
        """불린 값 뱃지 생성"""
        true_label = true_text if true_text is not None else _('Active')
        false_label = false_text if false_text is not None else _('Inactive')
        if value:
            return format_html(
                '<span style="color: {};">✓ {}</span>',
                true_color or COLOR_SUCCESS, true_label
            )
        return format_html(
            '<span style="color: {};">✗ {}</span>',
            false_color or COLOR_MUTED, false_label
        )

    @staticmethod
    def active_status_badge(is_active: bool) -> SafeString:
        """활성화 상태 뱃지 생성"""
        return AdminDisplayService.boolean_badge(
            is_active,
            true_text=_('Active'),
            false_text=_('Inactive'),
        )

    @staticmethod
    def read_status_badge(is_read: bool) -> SafeString:
        """읽음 상태 뱃지 생성"""
        if is_read:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px;">{}</span>',
                COLOR_DARKENED_BG,
                COLOR_TEXT,
                _('Read'),
            )
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px;">{}</span>',
            COLOR_PRIMARY,
            COLOR_BG,
            _('Unread'),
        )

    @staticmethod
    def visibility_badge(is_hidden: bool) -> SafeString:
        """공개/숨김 뱃지 생성"""
        if is_hidden:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px;">{}</span>',
                COLOR_DANGER,
                COLOR_BG,
                _('Hidden'),
            )
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px;">{}</span>',
            COLOR_SUCCESS,
            COLOR_BG,
            _('Public'),
        )

    def advertise_badge() -> SafeString:
        """광고 뱃지 생성"""
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px;">{}</span>',
            COLOR_INFO,
            COLOR_BG,
            _('Advertisement'),
        )

    @staticmethod
    def image_preview(
        image_url: Optional[str],
        width: str = '80px',
        height: str = '80px',
        rounded: bool = False
    ) -> SafeString:
        """이미지 미리보기 생성 (loading="lazy" 적용)"""
        if not image_url:
            if height == 'auto':
                return SafeString('')
            return format_html(
                '<div style="width: {}; height: {}; background: {}; '
                'border-radius: {}; display: flex; align-items: center; '
                'justify-content: center; color: {};">{}</div>',
                width,
                height,
                COLOR_DARKENED_BG,
                '50%' if rounded else '8px',
                COLOR_MUTED,
                _('None'),
            )

        if height == 'auto':
            return format_html(
                '<img src="{}" loading="lazy" alt="{}" style="max-width: {}; border-radius: {};" />',
                image_url,
                _('Preview'),
                width,
                '50%' if rounded else '8px',
            )

        return format_html(
            '<img src="{}" loading="lazy" alt="{}" style="width: {}; height: {}; object-fit: cover; '
            'border-radius: {};" />',
            image_url,
            _('Preview'),
            width,
            height,
            '50%' if rounded else '8px',
        )

    @staticmethod
    def avatar_preview(avatar_obj: Optional[Any]) -> SafeString:
        """아바타 미리보기 생성 (원형)"""
        width, height = AVATAR_SIZE
        if avatar_obj:
            return AdminDisplayService.image_preview(
                avatar_obj.url,
                width=width,
                height=height,
                rounded=True
            )
        return AdminDisplayService.image_preview(None, width=width, height=height, rounded=True)

    @staticmethod
    def cover_preview(cover_obj: Optional[Any], max_width: str = COVER_MAX_WIDTH) -> str:
        """커버 이미지 미리보기 생성"""
        if not cover_obj:
            return _('No cover image')
        return format_html(
            '<img src="{}" loading="lazy" alt="{}" style="max-width: {}; border-radius: 8px;" />',
            cover_obj.url,
            _('Cover image'),
            max_width,
        )

    @staticmethod
    def count_badge(count: int, icon: str = '📝', color: str = None) -> SafeString:
        """아이콘 포함 카운트 뱃지 생성"""
        return format_html(
            '<span style="color: {};">{} {}</span>',
            color or COLOR_TEXT, icon, count
        )

    @staticmethod
    def post_count_badge(count: int) -> SafeString:
        return AdminDisplayService.count_badge(count, icon='📝')

    @staticmethod
    def comment_count_badge(count: int) -> SafeString:
        return AdminDisplayService.count_badge(count, icon='💬')

    @staticmethod
    def like_count_badge(count: int) -> SafeString:
        return AdminDisplayService.count_badge(count, icon='👍', color=COLOR_DANGER)

    @staticmethod
    def user_info_box(user: Any) -> SafeString:
        """사용자 정보 박스 생성"""
        return format_html(
            '<div style="background: {}; padding: 12px; border-radius: 6px; border: 1px solid {};">'
            '<p style="margin: 4px 0; color: {};"><strong>{}:</strong> {}</p>'
            '<p style="margin: 4px 0; color: {};"><strong>{}:</strong> {}</p>'
            '<p style="margin: 4px 0; color: {};"><strong>{}:</strong> {}</p>'
            '<p style="margin: 4px 0; color: {};"><strong>{}:</strong> {}</p>'
            '</div>',
            COLOR_DARKENED_BG, COLOR_BORDER,
            COLOR_TEXT, _('Email'), user.email or '-',
            COLOR_TEXT, _('Date joined'), user.date_joined.strftime(DATETIME_FORMAT_SHORT) if user.date_joined else '-',
            COLOR_TEXT, _('Last login'), user.last_login.strftime(DATETIME_FORMAT_SHORT) if user.last_login else _('None'),
            COLOR_TEXT, _('Active status'), _('Active') if user.is_active else _('Inactive'),
        )

    @staticmethod
    def config_badges(config: Any) -> SafeString:
        """포스트 설정 뱃지들 생성"""
        badges = []
        if config.hide:
            badges.append(str(AdminDisplayService.visibility_badge(True)))
        if config.advertise:
            badges.append(str(AdminDisplayService.advertise_badge()))

        if not badges:
            return format_html('<span style="color: {};">-</span>', COLOR_MUTED)

        return mark_safe(' '.join(badges))

    @staticmethod
    def publish_status_badge(post: Any) -> SafeString:
        """발행 상태 뱃지 생성 (휴지통/임시글/발행됨/예약됨)"""
        from django.utils import timezone

        if getattr(post, 'deleted_date', None) is not None:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px; font-weight: 600;">{}</span>',
                COLOR_DANGER,
                COLOR_BG,
                _('Trash'),
            )
        if post.published_date is None:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px; font-weight: 600;">{}</span>',
                COLOR_MUTED,
                COLOR_BG,
                _('Draft'),
            )
        elif post.published_date > timezone.now():
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px; font-weight: 600;">{}</span>',
                COLOR_WARNING,
                COLOR_TEXT,
                _('Scheduled'),
            )
        else:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px; font-weight: 600;">{}</span>',
                COLOR_SUCCESS,
                COLOR_BG,
                _('Published'),
            )

    @staticmethod
    def post_status_badges(config: Any) -> SafeString:
        """포스트 전체 상태 뱃지 생성"""
        badges = []
        if hasattr(config, 'hide'):
            if config.hide:
                badges.append(format_html(
                    '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">{}</span>',
                    COLOR_DANGER, COLOR_BG, _('Hidden')
                ))
            else:
                badges.append(format_html(
                    '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">{}</span>',
                    COLOR_SUCCESS, COLOR_BG, _('Public')
                ))
            if config.advertise:
                badges.append(format_html(
                    '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">{}</span>',
                    COLOR_INFO, COLOR_BG, _('Advertisement')
                ))
            if config.block_comment:
                badges.append(format_html(
                    '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">{}</span>',
                    COLOR_DANGER, COLOR_BG, _('Comments disabled')
                ))
        return mark_safe(' '.join(str(b) for b in badges)) if badges else format_html('<span style="color: {};">-</span>', COLOR_MUTED)

    @staticmethod
    def tags_badges(tags_queryset: QuerySet, max_display: int = MAX_TAGS_DISPLAY) -> SafeString:
        """태그 뱃지들 생성 (쿼리 최적화)"""
        # max_display+1개만 가져와서 더 있는지 확인
        tags_list = list(tags_queryset[:max_display + 1])
        total_count = len(tags_list)
        has_more = total_count > max_display

        if total_count == 0:
            return format_html(
                '<span style="color: {};">{}</span>',
                COLOR_MUTED,
                _('No tags'),
            )

        # Display only max_display tags
        display_tags = tags_list[:max_display]

        html_parts = [
            format_html(
                '<span style="background: {}; color: {}; padding: 2px 8px; '
                'border-radius: 4px; font-size: 11px; margin-right: 4px; opacity: 0.8;">{}</span>',
                COLOR_INFO, COLOR_BG, tag.value
            ) for tag in display_tags
        ]

        if has_more:
            # 추가 태그가 있을 때만 count() 호출
            actual_count = tags_queryset.count()
            remaining = actual_count - max_display
            html_parts.append(format_html(' <span style="color: {};">+{}</span>', COLOR_MUTED, remaining))

        return mark_safe(''.join(str(part) for part in html_parts))

    @staticmethod
    def html(
        html_string: str,
        use_folding: bool = False,
        remove_lazy_load: bool = False
    ) -> SafeString:
        """HTML 문자열을 안전하게 표시

        Args:
            html_string: 표시할 HTML 문자열
            use_folding: 긴 컨텐츠를 접을 수 있게 표시 (기본값: False)
            remove_lazy_load: lazy loading 속성 제거 (기본값: False)
        """
        processed_html = html_string

        # lazy loading 제거
        if remove_lazy_load and processed_html:
            processed_html = processed_html.replace('loading="lazy"', '')

        # 접기 기능 추가
        if use_folding and processed_html:
            # 긴 컨텐츠를 접을 수 있게 details/summary 태그로 감싸기
            return mark_safe(f'''
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; padding: 8px; background: {COLOR_DARKENED_BG};
                                   border-radius: 4px; user-select: none; color: {COLOR_TEXT};">
                        <strong>{_('Expand/collapse HTML preview')}</strong>
                    </summary>
                    <div style="margin-top: 10px; padding: 12px; border: 1px solid {COLOR_BORDER};
                               border-radius: 4px; max-height: 400px; overflow-y: auto; background: {COLOR_BG};">
                        {processed_html}
                    </div>
                </details>
            ''')

        return mark_safe(processed_html)

    @staticmethod
    def image(image_url: str, max_width: str = '400px') -> SafeString:
        """이미지 표시 (최대 너비 지정)"""
        return format_html(
            '<img src="{}" loading="lazy" alt="image" style="max-width: {}; border-radius: 8px;" />',
            image_url, max_width
        )

    @staticmethod
    def video(video_url: str, max_width: str = '400px') -> SafeString:
        """비디오 표시 (최대 너비 지정)"""
        return format_html(
            '<video controls preload="none" style="max-width: {}; border-radius: 8px;"><source src="{}" type="video/mp4"></video>',
            max_width, video_url
        )

    @staticmethod
    def link(url: str, text: Optional[str] = None) -> SafeString:
        """링크 표시"""
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer" style="color: {}; text-decoration: none;">{}</a>',
            url,
            COLOR_PRIMARY,
            text if text is not None else _('Open'),
        )

    @staticmethod
    def check_mark(value: Any) -> SafeString:
        """체크마크 표시 (truthy 값이면 체크, falsy 값이면 X)"""
        if value:
            return format_html('<span style="color: {};">✓</span>', COLOR_SUCCESS)
        return format_html('<span style="color: {};">✗</span>', COLOR_MUTED)

    @staticmethod
    def empty_placeholder(text: str = '-') -> SafeString:
        """빈 값 플레이스홀더 생성"""
        return format_html('<span style="color: {};">{}</span>', COLOR_MUTED, text)

    @staticmethod
    def date_display(date_obj: Optional[Any], format: str = '%Y-%m-%d %H:%M') -> SafeString:
        """날짜 표시 (에러 처리 포함)"""
        if not date_obj:
            return AdminDisplayService.empty_placeholder(_('None'))

        try:
            return SafeString(date_obj.strftime(format))
        except Exception:
            return AdminDisplayService.empty_placeholder(_('Error'))

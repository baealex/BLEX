"""
Admin Display & Link Service
재사용 가능한 display 및 링크 생성 로직
"""
from typing import Optional, Any
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe, SafeString
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
    def create_external_link(url: Optional[str], text: str = '링크') -> SafeString:
        """외부 링크 생성"""
        if not url:
            return format_html('<span style="color: {};">-</span>', COLOR_MUTED)

        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer" style="color: {}; text-decoration: none;">{}</a>',
            url, COLOR_PRIMARY, text
        )


class AdminDisplayService:
    """Admin display 컴포넌트 생성 서비스"""

    @staticmethod
    def role_badge(role: str, profile_model: Optional[Any] = None) -> SafeString:
        """역할 뱃지 생성 (관리자/작가/독자)"""
        badge_configs = {
            Profile.Role.EDITOR: (COLOR_SUCCESS, '작가'),
            Profile.Role.READER: (COLOR_MUTED, '독자'),
        }

        color, text = badge_configs.get(role, (COLOR_MUTED, '독자'))

        return format_html(
            '<span style="background: {}; color: {}; padding: 4px 10px; '
            'border-radius: 4px; font-size: 12px; font-weight: 600;">{}</span>',
            color, COLOR_BG, text
        )

    @staticmethod
    def boolean_badge(
        value: bool,
        true_text: str = '활성',
        false_text: str = '비활성',
        true_color: str = None,
        false_color: str = None
    ) -> SafeString:
        """불린 값 뱃지 생성"""
        if value:
            return format_html(
                '<span style="color: {};">✓ {}</span>',
                true_color or COLOR_SUCCESS, true_text
            )
        return format_html(
            '<span style="color: {};">✗ {}</span>',
            false_color or COLOR_MUTED, false_text
        )

    @staticmethod
    def active_status_badge(is_active: bool) -> SafeString:
        """활성화 상태 뱃지 생성"""
        return AdminDisplayService.boolean_badge(
            is_active,
            true_text='활성',
            false_text='비활성'
        )

    @staticmethod
    def read_status_badge(is_read: bool) -> SafeString:
        """읽음 상태 뱃지 생성"""
        if is_read:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px;">읽음</span>',
                COLOR_DARKENED_BG, COLOR_TEXT
            )
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px;">읽지 않음</span>',
            COLOR_PRIMARY, COLOR_BG
        )

    @staticmethod
    def visibility_badge(is_hidden: bool) -> SafeString:
        """공개/숨김 뱃지 생성"""
        if is_hidden:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px;">숨김</span>',
                COLOR_DANGER, COLOR_BG
            )
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px;">공개</span>',
            COLOR_SUCCESS, COLOR_BG
        )

    def advertise_badge() -> SafeString:
        """광고 뱃지 생성"""
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; '
            'border-radius: 4px; font-size: 11px;">광고</span>',
            COLOR_INFO, COLOR_BG
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
                'justify-content: center; color: {};">없음</div>',
                width, height, COLOR_DARKENED_BG, '50%' if rounded else '8px', COLOR_MUTED
            )

        if height == 'auto':
            return format_html(
                '<img src="{}" loading="lazy" alt="preview" style="max-width: {}; border-radius: {};" />',
                image_url, width, '50%' if rounded else '8px'
            )

        return format_html(
            '<img src="{}" loading="lazy" alt="preview" style="width: {}; height: {}; object-fit: cover; '
            'border-radius: {};" />',
            image_url, width, height, '50%' if rounded else '8px'
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
            return '커버 이미지 없음'
        return format_html(
            '<img src="{}" loading="lazy" alt="cover" style="max-width: {}; border-radius: 8px;" />',
            cover_obj.url, max_width
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
            '<p style="margin: 4px 0; color: {};"><strong>이메일:</strong> {}</p>'
            '<p style="margin: 4px 0; color: {};"><strong>가입일:</strong> {}</p>'
            '<p style="margin: 4px 0; color: {};"><strong>마지막 로그인:</strong> {}</p>'
            '<p style="margin: 4px 0; color: {};"><strong>활성 상태:</strong> {}</p>'
            '</div>',
            COLOR_DARKENED_BG, COLOR_BORDER,
            COLOR_TEXT, user.email or '-',
            COLOR_TEXT, user.date_joined.strftime(DATETIME_FORMAT_SHORT) if user.date_joined else '-',
            COLOR_TEXT, user.last_login.strftime(DATETIME_FORMAT_SHORT) if user.last_login else '없음',
            COLOR_TEXT, '활성화' if user.is_active else '비활성화'
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
        """발행 상태 뱃지 생성 (임시글/발행됨/예약됨)"""
        from django.utils import timezone

        if post.published_date is None:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px; font-weight: 600;">임시글</span>',
                COLOR_MUTED, COLOR_BG
            )
        elif post.published_date > timezone.now():
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px; font-weight: 600;">예약됨</span>',
                COLOR_WARNING, COLOR_TEXT
            )
        else:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; '
                'border-radius: 4px; font-size: 11px; font-weight: 600;">발행됨</span>',
                COLOR_SUCCESS, COLOR_BG
            )

    @staticmethod
    def post_status_badges(config: Any) -> SafeString:
        """포스트 전체 상태 뱃지 생성"""
        badges = []
        if hasattr(config, 'hide'):
            if config.hide:
                badges.append(format_html(
                    '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">숨김</span>',
                    COLOR_DANGER, COLOR_BG
                ))
            else:
                badges.append(format_html(
                    '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">공개</span>',
                    COLOR_SUCCESS, COLOR_BG
                ))
            if config.advertise:
                badges.append(format_html(
                    '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">광고</span>',
                    COLOR_INFO, COLOR_BG
                ))
            if config.block_comment:
                badges.append(format_html(
                    '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">댓글차단</span>',
                    COLOR_DANGER, COLOR_BG
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
            return format_html('<span style="color: {};">태그 없음</span>', COLOR_MUTED)

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
                        <strong>HTML 미리보기 펼치기/접기</strong>
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
            '<video controls style="max-width: {}; border-radius: 8px;"><source src="{}" type="video/mp4"></video>',
            max_width, video_url
        )

    @staticmethod
    def link(url: str, text: str = 'Open') -> SafeString:
        """링크 표시"""
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer" style="color: {}; text-decoration: none;">{}</a>',
            url, COLOR_PRIMARY, text
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
            return AdminDisplayService.empty_placeholder('없음')

        try:
            return SafeString(date_obj.strftime(format))
        except Exception:
            return AdminDisplayService.empty_placeholder('오류')

"""
GlobalBanner Admin Configuration
Site Operations / 사이트 운영
"""
from django.contrib import admin
from django.http import HttpRequest
from django.db.models import QuerySet

from board.models import GlobalBanner

from .service import AdminDisplayService
from .constants import LIST_PER_PAGE_DEFAULT, DATETIME_FORMAT_FULL


@admin.register(GlobalBanner)
class GlobalBannerAdmin(admin.ModelAdmin):
    """사이트 전역 배너 관리 (관리자 전용)"""
    search_fields = ['title', 'content_html']

    list_filter = [
        'is_active',
        'banner_type',
        'position',
        ('created_date', admin.DateFieldListFilter),
    ]

    actions = ['activate_banners', 'deactivate_banners']

    list_display = [
        'id',
        'title',
        'banner_type_display',
        'position_display',
        'active_status',
        'order',
        'created_by',
        'created_date',
        'updated_date'
    ]
    list_display_links = ['title']
    list_per_page = LIST_PER_PAGE_DEFAULT

    fieldsets = (
        ('기본 정보', {
            'fields': ('title', 'content_html'),
            'description': '⚠️ 글로벌 배너는 모든 포스트에 표시됩니다. HTML은 sanitize되지 않으므로 신중히 작성하세요.'
        }),
        ('배너 설정', {
            'fields': ('banner_type', 'position', 'is_active', 'order')
        }),
        ('메타데이터', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['created_by', 'created_at', 'updated_at']

    def banner_type_display(self, obj: GlobalBanner) -> str:
        """배너 타입 표시"""
        type_colors = {
            'horizontal': '#3b82f6',  # blue
            'sidebar': '#8b5cf6',  # purple
        }
        color = type_colors.get(obj.banner_type, '#6b7280')
        return f'<span style="color: {color}; font-weight: bold;">● {obj.get_banner_type_display()}</span>'
    banner_type_display.short_description = '배너 타입'
    banner_type_display.allow_tags = True

    def position_display(self, obj: GlobalBanner) -> str:
        """배너 위치 표시"""
        position_colors = {
            'top': '#3b82f6',  # blue
            'bottom': '#10b981',  # green
            'left': '#8b5cf6',  # purple
            'right': '#ec4899',  # pink
        }
        color = position_colors.get(obj.position, '#6b7280')
        return f'<span style="background: {color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">{obj.get_position_display()}</span>'
    position_display.short_description = '위치'
    position_display.allow_tags = True

    def active_status(self, obj: GlobalBanner) -> str:
        return AdminDisplayService.active_status_badge(obj.is_active)
    active_status.short_description = '활성화 상태'

    def created_at(self, obj: GlobalBanner) -> str:
        return AdminDisplayService.date_display(obj.created_date, DATETIME_FORMAT_FULL)
    created_at.short_description = '생성일시'

    def updated_at(self, obj: GlobalBanner) -> str:
        return AdminDisplayService.date_display(obj.updated_date, DATETIME_FORMAT_FULL)
    updated_at.short_description = '수정일시'

    def save_model(self, request: HttpRequest, obj: GlobalBanner, form, change):
        """Save model and track who created it"""
        if not change:  # New object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def activate_banners(self, request: HttpRequest, queryset: QuerySet[GlobalBanner]) -> None:
        """선택한 배너 활성화"""
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count}개의 글로벌 배너를 활성화했습니다.')
    activate_banners.short_description = '선택한 배너 활성화'

    def deactivate_banners(self, request: HttpRequest, queryset: QuerySet[GlobalBanner]) -> None:
        """선택한 배너 비활성화"""
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count}개의 글로벌 배너를 비활성화했습니다.')
    deactivate_banners.short_description = '선택한 배너 비활성화'

    def has_add_permission(self, request):
        """Only staff can add global banners"""
        return request.user.is_staff and request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        """Only staff can change global banners"""
        return request.user.is_staff and request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        """Only staff can delete global banners"""
        return request.user.is_staff and request.user.is_superuser

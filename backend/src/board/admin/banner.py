"""
Banner Admin Configuration
"""
from django.contrib import admin
from django.http import HttpRequest
from django.db.models import QuerySet
from django.utils.html import format_html

from board.models import Banner

from .service import AdminDisplayService
from .constants import LIST_PER_PAGE_DEFAULT, DATETIME_FORMAT_FULL


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    """사용자 배너 관리 페이지"""
    search_fields = ['title', 'user__username', 'content_html']

    list_filter = [
        'is_active',
        'banner_type',
        'position',
        ('created_date', admin.DateFieldListFilter),
    ]

    actions = ['activate_banners', 'deactivate_banners']

    list_display = [
        'id',
        'user',
        'title',
        'banner_type_display',
        'position_display',
        'active_status',
        'order',
        'created_date',
        'updated_date'
    ]
    list_display_links = ['title']
    list_per_page = LIST_PER_PAGE_DEFAULT

    fieldsets = (
        ('기본 정보', {
            'fields': ('user', 'title', 'content_html')
        }),
        ('배너 설정', {
            'fields': ('banner_type', 'position', 'is_active', 'order')
        }),
        ('메타데이터', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['created_at', 'updated_at']

    def banner_type_display(self, obj: Banner) -> str:
        """배너 타입 표시"""
        type_colors = {
            'horizontal': '#3b82f6',
            'sidebar': '#8b5cf6',
        }
        color = type_colors.get(obj.banner_type, '#6b7280')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">{}</span>',
            color, obj.get_banner_type_display()
        )
    banner_type_display.short_description = '배너 타입'

    def position_display(self, obj: Banner) -> str:
        """배너 위치 표시"""
        position_colors = {
            'top': '#3b82f6',
            'bottom': '#10b981',
            'left': '#8b5cf6',
            'right': '#ec4899',
        }
        color = position_colors.get(obj.position, '#6b7280')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">{}</span>',
            color, obj.get_position_display()
        )
    position_display.short_description = '위치'

    def active_status(self, obj: Banner) -> str:
        return AdminDisplayService.active_status_badge(obj.is_active)
    active_status.short_description = '활성화 상태'

    def created_at(self, obj: Banner) -> str:
        return AdminDisplayService.date_display(obj.created_date, DATETIME_FORMAT_FULL)
    created_at.short_description = '생성일시'

    def updated_at(self, obj: Banner) -> str:
        return AdminDisplayService.date_display(obj.updated_date, DATETIME_FORMAT_FULL)
    updated_at.short_description = '수정일시'

    def activate_banners(self, request: HttpRequest, queryset: QuerySet[Banner]) -> None:
        """선택한 배너 활성화"""
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count}개의 배너를 활성화했습니다.')
    activate_banners.short_description = '선택한 배너 활성화'

    def deactivate_banners(self, request: HttpRequest, queryset: QuerySet[Banner]) -> None:
        """선택한 배너 비활성화"""
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count}개의 배너를 비활성화했습니다.')
    deactivate_banners.short_description = '선택한 배너 비활성화'

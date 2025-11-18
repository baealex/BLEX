"""
Global Notice Admin Configuration
"""
from django.contrib import admin
from django.http import HttpRequest
from django.db.models import QuerySet

from board.models import GlobalNotice

from .service import AdminDisplayService
from .constants import LIST_PER_PAGE_DEFAULT, DATETIME_FORMAT_FULL


@admin.register(GlobalNotice)
class GlobalNoticeAdmin(admin.ModelAdmin):
    """전체 공지 관리 페이지"""
    search_fields = ['title', 'url']

    list_filter = [
        'is_active',
        ('created_date', admin.DateFieldListFilter),
    ]

    actions = ['activate_notices', 'deactivate_notices']

    list_display = [
        'id',
        'title',
        'url',
        'active_status',
        'created_date',
        'updated_date'
    ]
    list_display_links = ['title']
    list_per_page = LIST_PER_PAGE_DEFAULT

    fieldsets = (
        ('기본 정보', {
            'fields': ('title', 'url', 'is_active')
        }),
        ('메타데이터', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['created_at', 'updated_at']

    def active_status(self, obj: GlobalNotice) -> str:
        return AdminDisplayService.active_status_badge(obj.is_active)
    active_status.short_description = '활성화 상태'

    def created_at(self, obj: GlobalNotice) -> str:
        return AdminDisplayService.date_display(obj.created_date, DATETIME_FORMAT_FULL)
    created_at.short_description = '생성일시'

    def updated_at(self, obj: GlobalNotice) -> str:
        return AdminDisplayService.date_display(obj.updated_date, DATETIME_FORMAT_FULL)
    updated_at.short_description = '수정일시'

    def activate_notices(self, request: HttpRequest, queryset: QuerySet[GlobalNotice]) -> None:
        """선택한 공지 활성화"""
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count}개의 공지를 활성화했습니다.')
    activate_notices.short_description = '선택한 공지 활성화'

    def deactivate_notices(self, request: HttpRequest, queryset: QuerySet[GlobalNotice]) -> None:
        """선택한 공지 비활성화"""
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count}개의 공지를 비활성화했습니다.')
    deactivate_notices.short_description = '선택한 공지 비활성화'

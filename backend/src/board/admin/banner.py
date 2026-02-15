"""
SiteNotice & SiteBanner Admin Configuration
"""
from django.contrib import admin
from django.http import HttpRequest
from django.db.models import QuerySet
from django.utils.html import format_html

from board.models import SiteNotice, SiteBanner

from .service import AdminDisplayService
from .constants import LIST_PER_PAGE_DEFAULT, DATETIME_FORMAT_FULL


@admin.register(SiteNotice)
class SiteNoticeAdmin(admin.ModelAdmin):
    """사이트 공지 관리 페이지"""
    search_fields = ['title', 'user__username', 'url']

    list_filter = [
        'scope',
        'is_active',
        ('created_date', admin.DateFieldListFilter),
    ]

    actions = ['activate_items', 'deactivate_items']

    list_display = [
        'id',
        'scope_display',
        'user',
        'title',
        'active_status',
        'order',
        'created_date',
        'updated_date'
    ]
    list_display_links = ['title']
    list_per_page = LIST_PER_PAGE_DEFAULT

    fieldsets = (
        ('기본 정보', {
            'fields': ('scope', 'user', 'title', 'url')
        }),
        ('상태', {
            'fields': ('is_active', 'order')
        }),
        ('메타데이터', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['created_at', 'updated_at']

    def scope_display(self, obj: SiteNotice) -> str:
        color = '#3b82f6' if obj.scope == 'global' else '#8b5cf6'
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">{}</span>',
            color, obj.get_scope_display()
        )
    scope_display.short_description = '범위'

    def active_status(self, obj: SiteNotice) -> str:
        return AdminDisplayService.active_status_badge(obj.is_active)
    active_status.short_description = '활성화 상태'

    def created_at(self, obj: SiteNotice) -> str:
        return AdminDisplayService.date_display(obj.created_date, DATETIME_FORMAT_FULL)
    created_at.short_description = '생성일시'

    def updated_at(self, obj: SiteNotice) -> str:
        return AdminDisplayService.date_display(obj.updated_date, DATETIME_FORMAT_FULL)
    updated_at.short_description = '수정일시'

    def activate_items(self, request: HttpRequest, queryset: QuerySet[SiteNotice]) -> None:
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count}개의 항목을 활성화했습니다.')
    activate_items.short_description = '선택한 항목 활성화'

    def deactivate_items(self, request: HttpRequest, queryset: QuerySet[SiteNotice]) -> None:
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count}개의 항목을 비활성화했습니다.')
    deactivate_items.short_description = '선택한 항목 비활성화'


@admin.register(SiteBanner)
class SiteBannerAdmin(admin.ModelAdmin):
    """사이트 배너 관리 페이지"""
    search_fields = ['title', 'user__username', 'content_html']

    list_filter = [
        'scope',
        'is_active',
        'banner_type',
        'position',
        ('created_date', admin.DateFieldListFilter),
    ]

    actions = ['activate_items', 'deactivate_items']

    list_display = [
        'id',
        'scope_display',
        'user',
        'title',
        'active_status',
        'order',
        'created_date',
        'updated_date'
    ]
    list_display_links = ['title']
    list_per_page = LIST_PER_PAGE_DEFAULT

    fieldsets = (
        ('기본 정보', {
            'fields': ('scope', 'user', 'title')
        }),
        ('배너 설정', {
            'fields': ('content_html', 'banner_type', 'position'),
        }),
        ('상태', {
            'fields': ('is_active', 'order')
        }),
        ('메타데이터', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['created_at', 'updated_at']

    def scope_display(self, obj: SiteBanner) -> str:
        color = '#3b82f6' if obj.scope == 'global' else '#8b5cf6'
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">{}</span>',
            color, obj.get_scope_display()
        )
    scope_display.short_description = '범위'

    def active_status(self, obj: SiteBanner) -> str:
        return AdminDisplayService.active_status_badge(obj.is_active)
    active_status.short_description = '활성화 상태'

    def created_at(self, obj: SiteBanner) -> str:
        return AdminDisplayService.date_display(obj.created_date, DATETIME_FORMAT_FULL)
    created_at.short_description = '생성일시'

    def updated_at(self, obj: SiteBanner) -> str:
        return AdminDisplayService.date_display(obj.updated_date, DATETIME_FORMAT_FULL)
    updated_at.short_description = '수정일시'

    def activate_items(self, request: HttpRequest, queryset: QuerySet[SiteBanner]) -> None:
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count}개의 항목을 활성화했습니다.')
    activate_items.short_description = '선택한 항목 활성화'

    def deactivate_items(self, request: HttpRequest, queryset: QuerySet[SiteBanner]) -> None:
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count}개의 항목을 비활성화했습니다.')
    deactivate_items.short_description = '선택한 항목 비활성화'

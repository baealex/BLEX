"""
SiteNotice & SiteBanner Admin Configuration
"""
from typing import Any

from django.contrib import admin, messages
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils.html import format_html

from board.models import SiteNotice, SiteBanner

from .action_confirmation import render_action_confirmation
from .constants import LIST_PER_PAGE_DEFAULT, DATETIME_FORMAT_FULL
from .mixins import is_admin_changelist_request
from .service import AdminDisplayService


class SiteContentActionAdminMixin:
    """Keep site-content state changes timestamped and auditable."""

    def _set_active_state(
        self,
        request: HttpRequest,
        queryset: QuerySet,
        *,
        is_active: bool,
        change_message: str,
    ) -> int:
        count = 0
        with transaction.atomic():
            selected_items = self.model.objects.select_for_update().filter(
                pk__in=queryset.values('pk'),
            )
            for item in selected_items:
                if item.is_active == is_active:
                    continue
                item.is_active = is_active
                item.save(update_fields=['is_active', 'updated_date'])
                self.log_change(request, item, change_message)
                count += 1
        return count

    @admin.action(description='선택한 항목 활성화')
    def activate_items(
        self,
        request: HttpRequest,
        queryset: QuerySet,
    ) -> Any:
        inactive_items = queryset.filter(is_active=False)
        if request.POST.get('confirm') != 'yes':
            if not inactive_items.exists():
                self.message_user(
                    request,
                    '활성화할 비활성 항목이 없습니다.',
                    level=messages.WARNING,
                )
                return None
            verbose_name = self.model._meta.verbose_name_plural
            return render_action_confirmation(
                request,
                self,
                inactive_items,
                action_name='activate_items',
                title=f'{verbose_name} 활성화 확인',
                warning=(
                    f'선택한 {verbose_name}는 활성화 즉시 서비스 화면에 '
                    '노출될 수 있습니다.'
                ),
                confirm_label='활성화',
                is_destructive=False,
            )

        count = self._set_active_state(
            request,
            inactive_items,
            is_active=True,
            change_message='Admin에서 활성화',
        )
        self.message_user(request, f'{count}개의 항목을 활성화했습니다.')

    @admin.action(description='선택한 항목 비활성화')
    def deactivate_items(
        self,
        request: HttpRequest,
        queryset: QuerySet,
    ) -> None:
        count = self._set_active_state(
            request,
            queryset.filter(is_active=True),
            is_active=False,
            change_message='Admin에서 비활성화',
        )
        self.message_user(request, f'{count}개의 항목을 비활성화했습니다.')


@admin.register(SiteNotice)
class SiteNoticeAdmin(SiteContentActionAdminMixin, admin.ModelAdmin):
    """사이트 공지 관리 페이지"""
    autocomplete_fields = ['user']
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

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'user',
        ).defer('user__password')

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

@admin.register(SiteBanner)
class SiteBannerAdmin(SiteContentActionAdminMixin, admin.ModelAdmin):
    """사이트 배너 관리 페이지"""
    autocomplete_fields = ['user']
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

    def get_queryset(self, request):
        queryset = super().get_queryset(request).select_related(
            'user',
        ).defer('user__password')
        if is_admin_changelist_request(request, self.model):
            return queryset.defer('content_html')
        return queryset

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

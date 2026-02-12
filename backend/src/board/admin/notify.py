"""
Notification Admin Configuration
"""
from typing import Any, Optional
from django.contrib import admin
from django.http import HttpRequest, HttpResponse
from django.db.models import QuerySet
from django.template.defaultfilters import truncatewords
from django.shortcuts import render, redirect
from django.urls import path
from django.contrib.auth.models import User
from django import forms

from board.models import Notify
from board.modules.notify import create_notify

from .service import AdminLinkService, AdminDisplayService
from .constants import LIST_PER_PAGE_DEFAULT, CONTENT_PREVIEW_WORDS, DATETIME_FORMAT_FULL


class BulkNotificationForm(forms.Form):
    """일괄 알림 발송 폼"""
    url = forms.CharField(
        label='링크 URL',
        max_length=255,
        required=False,
        initial='/',
        help_text='알림 클릭 시 이동할 URL (기본값: /)',
        widget=forms.TextInput(attrs={'style': 'width: 100%;'})
    )
    content = forms.CharField(
        label='알림 내용',
        widget=forms.Textarea(attrs={'rows': 5, 'style': 'width: 100%;'}),
        help_text='모든 사용자에게 전송될 알림 메시지'
    )


@admin.register(Notify)
class NotifyAdmin(admin.ModelAdmin):
    """알림 관리 페이지"""
    autocomplete_fields = ['user']
    search_fields = ['content', 'user__username', 'url']

    list_filter = [
        'has_read',
        ('created_date', admin.DateFieldListFilter),
        ('updated_date', admin.DateFieldListFilter),
    ]

    actions = ['mark_as_read', 'mark_as_unread', 'send_notifications']

    list_display = ['id', 'user_link', 'content_preview', 'read_status', 'url_link', 'created_date']
    list_display_links = ['content_preview']
    list_per_page = LIST_PER_PAGE_DEFAULT
    date_hierarchy = 'created_date'

    fieldsets = (
        ('기본 정보', {
            'fields': ('user', 'url', 'content')
        }),
        ('상태', {
            'fields': ('has_read', 'key')
        }),
        ('메타데이터', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['key', 'created_at', 'updated_at']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = '사용자'

    def content_preview(self, obj: Notify) -> str:
        return truncatewords(obj.content, CONTENT_PREVIEW_WORDS)
    content_preview.short_description = '내용'

    def read_status(self, obj):
        return AdminDisplayService.read_status_badge(obj.has_read)
    read_status.short_description = '읽음 상태'

    def url_link(self, obj):
        return AdminLinkService.create_external_link(obj.url)
    url_link.short_description = 'URL'

    def created_at(self, obj: Notify) -> str:
        return AdminDisplayService.date_display(obj.created_date, DATETIME_FORMAT_FULL)
    created_at.short_description = '생성일시'

    def updated_at(self, obj: Notify) -> str:
        return AdminDisplayService.date_display(obj.updated_date, DATETIME_FORMAT_FULL)
    updated_at.short_description = '수정일시'

    def mark_as_read(self, request: HttpRequest, queryset: QuerySet[Notify]) -> None:
        count = queryset.update(has_read=True)
        self.message_user(request, f'{count}개의 알림을 읽음으로 표시했습니다.')
    mark_as_read.short_description = '선택한 알림을 읽음으로 표시'

    def mark_as_unread(self, request: HttpRequest, queryset: QuerySet[Notify]) -> None:
        count = queryset.update(has_read=False)
        self.message_user(request, f'{count}개의 알림을 읽지 않음으로 표시했습니다.')
    mark_as_unread.short_description = '선택한 알림을 읽지 않음으로 표시'

    def send_notifications(self, request: HttpRequest, queryset: QuerySet[Notify]) -> None:
        """텔레그램 알림 전송 (개별 처리 필요)"""
        count = 0
        for notify in queryset:
            try:
                notify.send_notify()
                count += 1
            except Exception as e:
                self.message_user(request, f'알림 전송 실패: {str(e)}', level='ERROR')
        self.message_user(request, f'{count}개의 알림을 전송했습니다.')
    send_notifications.short_description = '선택한 알림 전송 (텔레그램)'

    def save_model(self, request: HttpRequest, obj: Notify, form: Any, change: bool) -> None:
        """중복 체크 후 저장"""
        obj.key = Notify.create_hash_key(user=obj.user, url=obj.url, content=obj.content)
        if Notify.objects.filter(key=obj.key).exists():
            self.message_user(request, '이미 동일한 알림이 존재합니다.', level='WARNING')
            return

        super().save_model(request, obj, form, change)
        try:
            obj.send_notify()
        except Exception as e:
            self.message_user(request, f'알림 전송 실패: {str(e)}', level='ERROR')

    def get_urls(self):
        """Custom URL 추가"""
        urls = super().get_urls()
        custom_urls = [
            path('bulk-send/', self.admin_site.admin_view(self.bulk_send_view), name='board_notify_bulk_send'),
        ]
        return custom_urls + urls

    def bulk_send_view(self, request: HttpRequest) -> HttpResponse:
        """일괄 알림 발송 페이지"""
        if request.method == 'POST':
            form = BulkNotificationForm(request.POST)
            if form.is_valid():
                url = form.cleaned_data['url'] or '/'
                content = form.cleaned_data['content']

                # 모든 활성 사용자에게 발송
                users = User.objects.filter(is_active=True)
                success_count = 0
                fail_count = 0

                for user in users:
                    try:
                        create_notify(user=user, url=url, content=content)
                        success_count += 1
                    except Exception as e:
                        fail_count += 1
                        print(f'Failed to send notification to {user.username}: {e}')

                self.message_user(
                    request,
                    f'총 {success_count}명에게 알림을 발송했습니다. (실패: {fail_count}명)',
                    level='SUCCESS'
                )
                return redirect('..')
        else:
            form = BulkNotificationForm()

        context = {
            **self.admin_site.each_context(request),
            'title': '전체 사용자에게 알림 발송',
            'form': form,
            'opts': self.model._meta,
        }
        return render(request, 'admin/board/notify/bulk_send.html', context)

    def changelist_view(self, request, extra_context=None):
        """알림 목록 페이지에 일괄 발송 버튼 추가"""
        extra_context = extra_context or {}
        extra_context['show_bulk_send_button'] = True
        return super().changelist_view(request, extra_context=extra_context)
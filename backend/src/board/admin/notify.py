"""
Notification Admin Configuration
"""
import logging
from typing import Any

from django import forms
from django.contrib import admin, messages
from django.contrib.admin.models import ADDITION, LogEntry
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.template.defaultfilters import truncatewords
from django.urls import path
from django.utils import timezone

from board.models import Notify
from board.services.bulk_notification_delivery_service import (
    BulkNotificationDeliveryService,
)

from .action_confirmation import render_action_confirmation
from .constants import (
    CONTENT_PREVIEW_WORDS,
    DATETIME_FORMAT_FULL,
    LIST_PER_PAGE_DEFAULT,
)
from .service import AdminDisplayService, AdminLinkService

logger = logging.getLogger('board.notification')


class NotifyAdminForm(forms.ModelForm):
    """Validate notification identity before the Admin save lifecycle."""

    class Meta:
        model = Notify
        fields = ['user', 'url', 'content', 'has_read']

    def clean(self) -> dict[str, Any]:
        cleaned_data = super().clean()
        user = cleaned_data.get('user')
        url = cleaned_data.get('url')
        content = cleaned_data.get('content')
        if user is None or url is None or content is None:
            return cleaned_data

        key = Notify.create_hash_key(
            user=user,
            url=url,
            content=content,
        )
        duplicates = Notify.objects.filter(key=key)
        if self.instance.pk is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise forms.ValidationError('이미 동일한 알림이 존재합니다.')

        self.instance.key = key
        return cleaned_data


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
        help_text='모든 활성 사용자에게 전송될 알림 메시지'
    )


@admin.register(Notify)
class NotifyAdmin(admin.ModelAdmin):
    """알림 관리 페이지"""
    form = NotifyAdminForm
    autocomplete_fields = ['user']
    search_fields = ['content', 'user__username', 'url']

    list_filter = [
        'has_read',
        ('created_date', admin.DateFieldListFilter),
        ('updated_date', admin.DateFieldListFilter),
    ]

    actions = ['mark_as_read', 'mark_as_unread', 'resend_notifications']

    list_display = [
        'id',
        'user_link',
        'content_preview',
        'read_status',
        'url_link',
        'created_date',
    ]
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

    def set_read_status(
        self,
        request: HttpRequest,
        queryset: QuerySet[Notify],
        *,
        has_read: bool,
    ) -> int:
        updated_at = timezone.now()
        with transaction.atomic():
            notifications = list(queryset.select_for_update())
            notification_ids = [notify.pk for notify in notifications]
            count = Notify.objects.filter(pk__in=notification_ids).update(
                has_read=has_read,
                updated_date=updated_at,
            )
            status_label = '읽음' if has_read else '읽지 않음'
            for notify in notifications:
                notify.has_read = has_read
                notify.updated_date = updated_at
                self.log_change(
                    request,
                    notify,
                    f'Admin에서 {status_label} 상태로 변경',
                )
        return count

    @admin.action(
        description='선택한 알림을 읽음으로 표시',
        permissions=['change'],
    )
    def mark_as_read(
        self,
        request: HttpRequest,
        queryset: QuerySet[Notify],
    ) -> None:
        count = self.set_read_status(
            request,
            queryset,
            has_read=True,
        )
        self.message_user(
            request,
            f'{count}개의 알림을 읽음으로 표시했습니다.',
            level=messages.SUCCESS,
        )

    @admin.action(
        description='선택한 알림을 읽지 않음으로 표시',
        permissions=['change'],
    )
    def mark_as_unread(
        self,
        request: HttpRequest,
        queryset: QuerySet[Notify],
    ) -> None:
        count = self.set_read_status(
            request,
            queryset,
            has_read=False,
        )
        self.message_user(
            request,
            f'{count}개의 알림을 읽지 않음으로 표시했습니다.',
            level=messages.SUCCESS,
        )

    @admin.action(
        description='선택한 알림 외부 채널로 재발송',
        permissions=['change'],
    )
    def resend_notifications(
        self,
        request: HttpRequest,
        queryset: QuerySet[Notify],
    ) -> Any:
        if request.POST.get('confirm') != 'yes':
            if not queryset.exists():
                self.message_user(
                    request,
                    '재발송할 알림이 없습니다.',
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                queryset,
                action_name='resend_notifications',
                title='외부 알림 재발송 확인',
                warning=(
                    '선택한 알림을 연결된 외부 채널로 다시 전송합니다. '
                    '수신자에게 중복 알림이 전달될 수 있습니다.'
                ),
                confirm_label='외부 알림 재발송',
            )

        sent_count = 0
        failed_count = 0
        for notify in queryset.select_related('user'):
            try:
                with transaction.atomic():
                    self.log_change(
                        request,
                        notify,
                        'Admin에서 외부 알림 재발송 요청',
                    )
                notify.send_notify()
            except Exception as error:
                failed_count += 1
                logger.error(
                    'Admin notification resend failed notification_id=%s '
                    'exception_type=%s',
                    notify.pk,
                    type(error).__name__,
                )
                continue
            sent_count += 1

        self.message_user(
            request,
            f'{sent_count}개의 알림을 외부 채널로 재발송했습니다.',
            level=messages.SUCCESS,
        )
        if failed_count:
            self.message_user(
                request,
                f'{failed_count}개의 알림은 재발송하지 못했습니다.',
                level=messages.ERROR,
            )
        return None

    def save_model(
        self,
        request: HttpRequest,
        obj: Notify,
        form: Any,
        change: bool,
    ) -> None:
        """Send newly created notifications without resending Admin edits."""
        obj.key = Notify.create_hash_key(
            user=obj.user,
            url=obj.url,
            content=obj.content,
        )
        super().save_model(request, obj, form, change)
        if change:
            return

        notification_id = obj.pk

        def deliver_after_commit() -> None:
            try:
                notification = Notify.objects.select_related('user').get(
                    pk=notification_id,
                )
                notification.send_notify()
            except Exception as error:
                logger.error(
                    'Admin notification delivery failed notification_id=%s '
                    'exception_type=%s',
                    notification_id,
                    type(error).__name__,
                )
                self.message_user(
                    request,
                    '알림은 저장했지만 외부 채널로 전송하지 못했습니다.',
                    level=messages.ERROR,
                )

        transaction.on_commit(
            deliver_after_commit,
            using=obj._state.db,
        )

    def get_urls(self):
        """Custom URL 추가"""
        urls = super().get_urls()
        custom_urls = [
            path(
                'bulk-send/',
                self.admin_site.admin_view(self.bulk_send_view),
                name='board_notify_bulk_send',
            ),
        ]
        return custom_urls + urls

    def bulk_send_view(self, request: HttpRequest) -> HttpResponse:
        """일괄 알림 발송 페이지"""
        if not self.has_add_permission(request):
            raise PermissionDenied

        confirmation = False
        target_count = None
        notification_url = None
        notification_content = None
        if request.method == 'POST':
            form = BulkNotificationForm(request.POST)
            if form.is_valid():
                url = form.cleaned_data['url'] or '/'
                content = form.cleaned_data['content']
                user_ids = list(
                    User.objects.filter(is_active=True).values_list(
                        'pk',
                        flat=True,
                    )
                )
                target_count = len(user_ids)
                notification_url = url
                notification_content = content

                if request.POST.get('confirm') != 'yes':
                    confirmation = True
                elif not user_ids:
                    self.message_user(
                        request,
                        '발송할 활성 사용자가 없습니다.',
                        level=messages.WARNING,
                    )
                    return redirect('..')
                else:
                    content_type = ContentType.objects.get_for_model(Notify)
                    with transaction.atomic():
                        LogEntry.objects.create(
                            user=request.user,
                            content_type=content_type,
                            object_id=None,
                            object_repr=f'전체 알림 발송 ({target_count}명)',
                            action_flag=ADDITION,
                            change_message=(
                                'Admin 전체 알림 발송 예약: '
                                f'대상 {target_count}명'
                            ),
                        )
                    BulkNotificationDeliveryService.enqueue(
                        user_ids=user_ids,
                        url=url,
                        content=content,
                    )
                    self.message_user(
                        request,
                        f'{target_count}명 대상 알림 발송 작업을 예약했습니다. '
                        '동일한 알림은 건너뜁니다.',
                        level=messages.SUCCESS,
                    )
                    return redirect('..')
        else:
            form = BulkNotificationForm()

        context = {
            **self.admin_site.each_context(request),
            'title': '전체 활성 사용자에게 알림 발송',
            'form': form,
            'opts': self.model._meta,
            'confirmation': confirmation,
            'target_count': target_count,
            'notification_url': notification_url,
            'notification_content': notification_content,
        }
        return render(request, 'admin/board/notify/bulk_send.html', context)

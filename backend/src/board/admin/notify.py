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
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.template.defaultfilters import truncatewords
from django.urls import path
from django.utils.html import format_html
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from board.models import Notify
from board.services.bulk_notification_delivery_service import (
    BulkNotificationDeliveryService,
)
from board.services.notification_url_service import NotificationUrlService

from .action_confirmation import render_action_confirmation
from .constants import (
    CONTENT_PREVIEW_WORDS,
    DATETIME_FORMAT_FULL,
    LIST_PER_PAGE_DEFAULT,
)
from .mixins import is_admin_changelist_request
from .service import AdminDisplayService, AdminLinkService

logger = logging.getLogger('board.notification')


class NotifyAdminForm(forms.ModelForm):
    """Validate notification identity before the Admin save lifecycle."""

    class Meta:
        model = Notify
        fields = ['user', 'url', 'content', 'has_read']

    def clean_url(self) -> str:
        return NotificationUrlService.validate(self.cleaned_data['url'])

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
            raise forms.ValidationError(
                _('A notification with the same identity already exists.'),
            )

        self.instance.key = key
        return cleaned_data


class BulkNotificationForm(forms.Form):
    """일괄 알림 발송 폼"""
    url = forms.CharField(
        label=_('Link URL'),
        max_length=255,
        required=False,
        initial='/',
        help_text=_('URL opened when the notification is clicked (default: /)'),
        widget=forms.TextInput(attrs={'style': 'width: 100%;'})
    )
    content = forms.CharField(
        label=_('Notification content'),
        widget=forms.Textarea(attrs={'rows': 5, 'style': 'width: 100%;'}),
        help_text=_('Message sent to every active user'),
    )

    def clean_url(self) -> str:
        url = self.cleaned_data['url'] or '/'
        return NotificationUrlService.validate(url)


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
    show_full_result_count = False
    date_hierarchy = 'created_date'

    fieldsets = (
        (_('Basic information'), {
            'fields': ('user', 'url', 'content')
        }),
        (_('Status'), {
            'fields': ('has_read', 'key')
        }),
        (_('Metadata'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['key', 'created_at', 'updated_at']

    def has_bulk_send_permission(self, request: HttpRequest) -> bool:
        """Whole-site notification delivery is reserved for superusers."""
        return request.user.is_superuser

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['can_bulk_send'] = self.has_bulk_send_permission(request)
        return super().changelist_view(request, extra_context=extra_context)

    def get_queryset(self, request):
        queryset = super().get_queryset(request).select_related(
            'user',
        ).defer('user__password')
        if is_admin_changelist_request(request, self.model):
            return queryset.defer('key')
        return queryset

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = _('User')

    def content_preview(self, obj: Notify) -> str:
        return truncatewords(obj.content, CONTENT_PREVIEW_WORDS)
    content_preview.short_description = _('Content')

    def read_status(self, obj):
        return AdminDisplayService.read_status_badge(obj.has_read)
    read_status.short_description = _('Read status')

    def url_link(self, obj):
        try:
            url = NotificationUrlService.validate(obj.url)
        except ValidationError:
            return format_html(
                '<span style="color: #b91c1c;">{}</span>',
                _('Unsafe URL'),
            )
        return AdminLinkService.create_external_link(url)
    url_link.short_description = 'URL'

    def created_at(self, obj: Notify) -> str:
        return AdminDisplayService.date_display(obj.created_date, DATETIME_FORMAT_FULL)
    created_at.short_description = _('Created at')

    def updated_at(self, obj: Notify) -> str:
        return AdminDisplayService.date_display(obj.updated_date, DATETIME_FORMAT_FULL)
    updated_at.short_description = _('Updated at')

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
            change_message = (
                _('Marked as read in Admin')
                if has_read
                else _('Marked as unread in Admin')
            )
            for notify in notifications:
                notify.has_read = has_read
                notify.updated_date = updated_at
                self.log_change(
                    request,
                    notify,
                    change_message,
                )
        return count

    @admin.action(
        description=_('Mark selected notifications as read'),
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
            ngettext(
                '%(count)d notification was marked as read.',
                '%(count)d notifications were marked as read.',
                count,
            ) % {'count': count},
            level=messages.SUCCESS,
        )

    @admin.action(
        description=_('Mark selected notifications as unread'),
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
            ngettext(
                '%(count)d notification was marked as unread.',
                '%(count)d notifications were marked as unread.',
                count,
            ) % {'count': count},
            level=messages.SUCCESS,
        )

    @admin.action(
        description=_('Resend selected notifications to external channels'),
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
                    _('There are no notifications to resend.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                queryset,
                action_name='resend_notifications',
                title=_('Confirm external notification resend'),
                warning=_(
                    'The selected notifications will be sent to their connected '
                    'external channels again. Recipients may receive duplicates.'
                ),
                confirm_label=_('Resend notifications'),
            )

        sent_count = 0
        failed_count = 0
        for notify in queryset.select_related('user'):
            try:
                with transaction.atomic():
                    self.log_change(
                        request,
                        notify,
                        _('Requested external notification resend in Admin'),
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
            ngettext(
                '%(count)d notification was resent to external channels.',
                '%(count)d notifications were resent to external channels.',
                sent_count,
            ) % {'count': sent_count},
            level=messages.SUCCESS,
        )
        if failed_count:
            self.message_user(
                request,
                ngettext(
                    '%(count)d notification could not be resent.',
                    '%(count)d notifications could not be resent.',
                    failed_count,
                ) % {'count': failed_count},
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
                    _(
                        'The notification was saved but could not be sent to '
                        'external channels.'
                    ),
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
        if not self.has_bulk_send_permission(request):
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
                        _('There are no active users to notify.'),
                        level=messages.WARNING,
                    )
                    return redirect('..')
                else:
                    content_type = ContentType.objects.get_for_model(Notify)
                    with transaction.atomic():
                        audit_log = LogEntry.objects.create(
                            user=request.user,
                            content_type=content_type,
                            object_id=None,
                            object_repr=ngettext(
                                'Bulk notification delivery (%(count)d recipient)',
                                'Bulk notification delivery (%(count)d recipients)',
                                target_count,
                            ) % {'count': target_count},
                            action_flag=ADDITION,
                            change_message=ngettext(
                                'Scheduled bulk notification delivery in Admin: '
                                '%(count)d recipient',
                                'Scheduled bulk notification delivery in Admin: '
                                '%(count)d recipients',
                                target_count,
                            ) % {'count': target_count},
                        )

                    try:
                        task_id = BulkNotificationDeliveryService.enqueue(
                            user_ids=user_ids,
                            url=url,
                            content=content,
                            audit_log_id=audit_log.pk,
                        )
                    except Exception as error:
                        logger.error(
                            'Admin bulk notification enqueue failed audit_log_id=%s '
                            'exception_type=%s',
                            audit_log.pk,
                            type(error).__name__,
                        )
                        task_id = None

                    if task_id is None:
                        LogEntry.objects.filter(pk=audit_log.pk).update(
                            change_message=ngettext(
                                'Failed to schedule bulk notification delivery '
                                'in Admin: %(count)d recipient',
                                'Failed to schedule bulk notification delivery '
                                'in Admin: %(count)d recipients',
                                target_count,
                            ) % {'count': target_count},
                        )
                        self.message_user(
                            request,
                            _('Could not schedule the notification delivery job.'),
                            level=messages.ERROR,
                        )
                        return redirect('..')

                    self.message_user(
                        request,
                        ngettext(
                            'Notification delivery was scheduled for %(count)d '
                            'recipient. Duplicate notifications will be skipped.',
                            'Notification delivery was scheduled for %(count)d '
                            'recipients. Duplicate notifications will be skipped.',
                            target_count,
                        ) % {'count': target_count},
                        level=messages.SUCCESS,
                    )
                    return redirect('..')
        else:
            form = BulkNotificationForm()

        context = {
            **self.admin_site.each_context(request),
            'title': _('Send a notification to all active users'),
            'form': form,
            'opts': self.model._meta,
            'confirmation': confirmation,
            'target_count': target_count,
            'notification_url': notification_url,
            'notification_content': notification_content,
        }
        return render(request, 'admin/board/notify/bulk_send.html', context)

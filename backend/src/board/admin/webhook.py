from typing import Any

from django import forms
from django.contrib import admin, messages
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from board.models import WebhookSubscription
from board.services.webhook_subscription_state_service import (
    WebhookSubscriptionStateService,
)
from board.services.webhook_url_service import WebhookUrlService

from .action_confirmation import render_action_confirmation
from .mixins import is_admin_changelist_request
from .service import AdminDisplayService, AdminLinkService


class WebhookSubscriptionAdminForm(forms.ModelForm):
    """Treat webhook URLs as write-only bearer credentials in Admin."""

    webhook_url = forms.URLField(
        label=_('Webhook URL'),
        max_length=500,
        required=False,
        help_text=_(
            'The existing URL is not displayed. Enter a new URL only when '
            'changing it.'
        ),
        widget=forms.PasswordInput(
            render_value=False,
            attrs={
                'autocomplete': 'new-password',
                'placeholder': _('Enter only to change'),
            },
        ),
    )

    class Meta:
        model = WebhookSubscription
        fields = [
            'scope',
            'author',
            'webhook_url',
            'name',
            'is_active',
        ]

    def clean_webhook_url(self) -> str:
        webhook_url = self.cleaned_data.get('webhook_url', '').strip()
        if webhook_url:
            if not WebhookUrlService.is_safe_url(webhook_url):
                raise forms.ValidationError(
                    _('Webhook URLs pointing to internal networks are not allowed.'),
                )
            return webhook_url
        if self.instance.pk is not None:
            return WebhookSubscription.objects.only('webhook_url').get(
                pk=self.instance.pk,
            ).webhook_url
        raise forms.ValidationError(_('Enter a webhook URL.'))


@admin.register(WebhookSubscription)
class WebhookSubscriptionAdmin(admin.ModelAdmin):
    form = WebhookSubscriptionAdminForm
    autocomplete_fields = ['author']
    show_full_result_count = False
    list_display = [
        'name',
        'scope',
        'author_link',
        'is_active',
        'failure_count',
        'last_success_date',
        'created_date',
    ]
    list_filter = ['scope', 'is_active', 'failure_count', ('created_date', admin.DateFieldListFilter)]
    search_fields = ['name', 'author__user__username']
    readonly_fields = [
        'created_date',
        'failure_count',
        'last_success_date',
    ]
    list_per_page = 30
    actions = [
        'reset_failure_count',
        'activate_subscriptions',
        'deactivate_subscriptions',
    ]

    def get_queryset(self, request):
        queryset = super().get_queryset(request).select_related(
            'author__user',
        ).defer(
            'webhook_url',
            'author__user__password',
        )
        if is_admin_changelist_request(request, self.model):
            return queryset.defer(
                'author__bio',
                'author__about_md',
                'author__about_html',
            )
        return queryset

    def author_link(self, obj: WebhookSubscription):
        if obj.author is None:
            return AdminDisplayService.empty_placeholder(_('All users'))
        return AdminLinkService.create_user_link(obj.author.user)
    author_link.short_description = _('Target')
    author_link.admin_order_field = 'author__user__username'

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            readonly_fields.append('is_active')
        return readonly_fields

    def set_subscription_state(
        self,
        request: HttpRequest,
        queryset: QuerySet[WebhookSubscription],
        *,
        is_active: bool,
        reset_failure_count: bool = False,
    ) -> int:
        with transaction.atomic():
            subscriptions = list(queryset.select_for_update())
            for subscription in subscriptions:
                WebhookSubscriptionStateService.set_active(
                    subscription,
                    is_active=is_active,
                    reset_failure_count=reset_failure_count,
                )
                if reset_failure_count:
                    change_message = _(
                        'Reset failure count and reactivated webhook in Admin'
                    )
                elif is_active:
                    change_message = _('Activated webhook in Admin')
                else:
                    change_message = _('Deactivated webhook in Admin')
                self.log_change(
                    request,
                    subscription,
                    change_message,
                )
        return len(subscriptions)

    @admin.action(
        description=_('Reset failure count and reactivate'),
        permissions=['change'],
    )
    def reset_failure_count(
        self,
        request: HttpRequest,
        queryset: QuerySet[WebhookSubscription],
    ) -> Any:
        targets = queryset.exclude(is_active=True, failure_count=0)
        if request.POST.get('confirm') != 'yes':
            if not targets.exists():
                self.message_user(
                    request,
                    _('There are no webhooks to reset or reactivate.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                targets,
                action_name='reset_failure_count',
                title=_('Confirm webhook failure reset'),
                warning=_(
                    'The failure count will be reset to zero and delivery to '
                    'the external URL will be reactivated.'
                ),
                confirm_label=_('Reset and reactivate'),
            )

        count = self.set_subscription_state(
            request,
            targets,
            is_active=True,
            reset_failure_count=True,
        )
        self.message_user(
            request,
            ngettext(
                '%(count)d webhook was reset and reactivated.',
                '%(count)d webhooks were reset and reactivated.',
                count,
            ) % {'count': count},
            level=messages.SUCCESS,
        )
        return None

    @admin.action(
        description=_('Activate selected webhooks'),
        permissions=['change'],
    )
    def activate_subscriptions(
        self,
        request: HttpRequest,
        queryset: QuerySet[WebhookSubscription],
    ) -> Any:
        targets = queryset.filter(is_active=False)
        if request.POST.get('confirm') != 'yes':
            if not targets.exists():
                self.message_user(
                    request,
                    _('There are no webhooks to activate.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                targets,
                action_name='activate_subscriptions',
                title=_('Confirm webhook activation'),
                warning=_(
                    'Delivery to the selected external webhook URLs will resume '
                    'with the next post notification. Failure counts are kept.'
                ),
                confirm_label=_('Activate webhooks'),
            )

        count = self.set_subscription_state(
            request,
            targets,
            is_active=True,
        )
        self.message_user(
            request,
            ngettext(
                '%(count)d webhook was activated.',
                '%(count)d webhooks were activated.',
                count,
            ) % {'count': count},
            level=messages.SUCCESS,
        )
        return None

    @admin.action(
        description=_('Deactivate selected webhooks'),
        permissions=['change'],
    )
    def deactivate_subscriptions(
        self,
        request: HttpRequest,
        queryset: QuerySet[WebhookSubscription],
    ) -> None:
        count = self.set_subscription_state(
            request,
            queryset.filter(is_active=True),
            is_active=False,
        )
        self.message_user(
            request,
            ngettext(
                '%(count)d webhook was deactivated.',
                '%(count)d webhooks were deactivated.',
                count,
            ) % {'count': count},
            level=messages.SUCCESS,
        )

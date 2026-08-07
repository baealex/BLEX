from typing import Any

from django.contrib import admin, messages
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest
from django.shortcuts import redirect
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from board.models import SocialAuth, SocialAuthProvider, TwoFactorAuth
from board.services.social_auth_connection_service import (
    SocialAuthConnectionService,
    SocialAuthDisconnectError,
)
from board.services.two_factor_setup_service import (
    TwoFactorSetupError,
    TwoFactorSetupService,
)

from .action_confirmation import render_action_confirmation
from .mixins import (
    ConfirmedActionDeleteAdminMixin,
    ReadOnlyRecordAdminMixin,
)
from .service import AdminDisplayService, AdminLinkService


@admin.register(SocialAuthProvider)
class SocialAuthProviderCompatibilityAdmin(admin.ModelAdmin):
    """Preserve legacy Admin URLs without exposing provider secrets."""

    canonical_settings_url = '/admin-settings/login'
    show_full_result_count = False

    def has_module_permission(self, request):
        return False

    def has_view_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def _redirect_to_canonical_settings(self):
        return redirect(self.canonical_settings_url)

    def changelist_view(self, request, extra_context=None):
        return self._redirect_to_canonical_settings()

    def add_view(self, request, form_url='', extra_context=None):
        return self._redirect_to_canonical_settings()

    def change_view(
        self,
        request,
        object_id,
        form_url='',
        extra_context=None,
    ):
        return self._redirect_to_canonical_settings()

    def delete_view(self, request, object_id, extra_context=None):
        return self._redirect_to_canonical_settings()

    def history_view(self, request, object_id, extra_context=None):
        return self._redirect_to_canonical_settings()


@admin.register(TwoFactorAuth)
class TwoFactorAuthAdmin(
    ConfirmedActionDeleteAdminMixin,
    ReadOnlyRecordAdminMixin,
    admin.ModelAdmin,
):
    list_display = [
        'user_link',
        'credential_status',
        'created_date',
    ]
    search_fields = ['user__username']
    list_filter = [('created_date', admin.DateFieldListFilter)]
    fields = ['user_link', 'credential_status', 'created_date']
    readonly_fields = ['user_link', 'credential_status', 'created_date']
    actions = ['disable_two_factor_auth']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user').defer(
            'recovery_key',
            'totp_secret',
            'user__password',
        )

    def user_link(self, obj: TwoFactorAuth):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = _('User')
    user_link.admin_order_field = 'user__username'

    def credential_status(self, obj: TwoFactorAuth):
        return AdminDisplayService.boolean_badge(
            True,
            true_text=_('Enabled'),
        )
    credential_status.short_description = _('2FA status')

    @admin.action(
        description=_('Disable 2FA for selected users'),
        permissions=['delete'],
    )
    def disable_two_factor_auth(
        self,
        request: HttpRequest,
        queryset: QuerySet[TwoFactorAuth],
    ) -> Any:
        if request.POST.get('confirm') != 'yes':
            if not queryset.exists():
                self.message_user(
                    request,
                    _('There are no 2FA settings to disable.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                queryset,
                action_name='disable_two_factor_auth',
                title=_('Confirm 2FA disable'),
                warning=_(
                    "The selected users' 2FA credentials will be deleted. The "
                    'existing 24-hour disable restriction still applies.'
                ),
                confirm_label=_('Disable 2FA'),
            )

        disabled = 0
        failed = 0
        for two_factor_auth in queryset.select_related('user'):
            try:
                with transaction.atomic():
                    self.log_deletions(request, [two_factor_auth])
                    TwoFactorSetupService.disable(two_factor_auth.user)
            except TwoFactorSetupError:
                failed += 1
                continue
            disabled += 1

        self.message_user(
            request,
            ngettext(
                '2FA was disabled for %(count)d user.',
                '2FA was disabled for %(count)d users.',
                disabled,
            ) % {'count': disabled},
            level=messages.SUCCESS,
        )
        if failed:
            self.message_user(
                request,
                ngettext(
                    '%(count)d user could not be processed under the existing '
                    'disable policy.',
                    '%(count)d users could not be processed under the existing '
                    'disable policy.',
                    failed,
                ) % {'count': failed},
                level=messages.WARNING,
            )
        return None


class SocialAuthProviderFilter(admin.RelatedFieldListFilter):
    """List providers without reading their client credentials."""

    def field_choices(self, field, request, model_admin):
        """Keep Django relation-filter semantics with a narrow select list."""
        ordering = self.field_admin_ordering(field, request, model_admin)
        queryset = field.remote_field.model._default_manager.complex_filter(
            field.get_limit_choices_to(),
        )
        if ordering:
            queryset = queryset.order_by(*ordering)
        return list(
            queryset.values_list(
                field.remote_field.get_related_field().attname,
                'key',
            )
        )


@admin.register(SocialAuth)
class SocialAuthAdmin(
    ConfirmedActionDeleteAdminMixin,
    ReadOnlyRecordAdminMixin,
    admin.ModelAdmin,
):
    list_display = [
        'user_link',
        'provider',
        'identity_status',
        'created_date',
    ]
    search_fields = ['user__username', 'provider__key']
    list_filter = [
        ('provider', SocialAuthProviderFilter),
        ('created_date', admin.DateFieldListFilter),
    ]
    fields = [
        'user_link',
        'provider',
        'identity_status',
        'extra_data_status',
        'created_date',
    ]
    readonly_fields = [
        'user_link',
        'provider',
        'identity_status',
        'extra_data_status',
        'created_date',
    ]
    actions = ['disconnect_social_auth']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'user',
            'provider',
        ).defer(
            'uid',
            'extra_data',
            'user__password',
            'provider__client_id',
            'provider__client_secret',
        )

    def user_link(self, obj: SocialAuth):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = _('User')
    user_link.admin_order_field = 'user__username'

    def identity_status(self, obj: SocialAuth):
        return AdminDisplayService.boolean_badge(
            True,
            true_text=_('Protected'),
        )
    identity_status.short_description = _('External identifier')

    def extra_data_status(self, obj: SocialAuth):
        return AdminDisplayService.boolean_badge(
            True,
            true_text=_('Protected'),
        )
    extra_data_status.short_description = _('Provider raw data')

    @admin.action(
        description=_('Disconnect selected social login connections'),
        permissions=['delete'],
    )
    def disconnect_social_auth(
        self,
        request: HttpRequest,
        queryset: QuerySet[SocialAuth],
    ) -> Any:
        if request.POST.get('confirm') != 'yes':
            if not queryset.exists():
                self.message_user(
                    request,
                    _('There are no social login connections to disconnect.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                queryset,
                action_name='disconnect_social_auth',
                title=_('Confirm social login disconnection'),
                warning=_(
                    'The selected external account connections will be deleted. '
                    'Accounts without a usable password or another connection '
                    'will be skipped.'
                ),
                confirm_label=_('Disconnect'),
            )

        disconnected = 0
        failed = 0
        for social_auth in queryset.select_related('user', 'provider'):
            try:
                with transaction.atomic():
                    self.log_deletions(request, [social_auth])
                    SocialAuthConnectionService.disconnect(social_auth)
            except SocialAuthDisconnectError:
                failed += 1
                continue
            disconnected += 1

        self.message_user(
            request,
            ngettext(
                '%(count)d social login connection was disconnected.',
                '%(count)d social login connections were disconnected.',
                disconnected,
            ) % {'count': disconnected},
            level=messages.SUCCESS,
        )
        if failed:
            self.message_user(
                request,
                ngettext(
                    '%(count)d connection was kept to preserve a login method.',
                    '%(count)d connections were kept to preserve a login method.',
                    failed,
                ) % {'count': failed},
                level=messages.WARNING,
            )
        return None

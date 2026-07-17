from typing import Any

from django.contrib import admin, messages
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest
from django.shortcuts import redirect

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
    user_link.short_description = '사용자'
    user_link.admin_order_field = 'user__username'

    def credential_status(self, obj: TwoFactorAuth):
        return AdminDisplayService.boolean_badge(
            True,
            true_text='활성화됨',
        )
    credential_status.short_description = '2FA 상태'

    @admin.action(
        description='선택한 사용자의 2FA 해제',
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
                    '해제할 2FA 설정이 없습니다.',
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                queryset,
                action_name='disable_two_factor_auth',
                title='2FA 해제 확인',
                warning=(
                    '선택한 사용자의 2FA 인증 정보가 삭제됩니다. 기존 '
                    '24시간 해제 제한은 그대로 적용됩니다.'
                ),
                confirm_label='2FA 해제',
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
            f'{disabled}명의 2FA를 해제했습니다.',
            level=messages.SUCCESS,
        )
        if failed:
            self.message_user(
                request,
                f'{failed}명은 기존 해제 정책에 따라 처리하지 못했습니다.',
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
    user_link.short_description = '사용자'
    user_link.admin_order_field = 'user__username'

    def identity_status(self, obj: SocialAuth):
        return AdminDisplayService.boolean_badge(
            True,
            true_text='보호됨',
        )
    identity_status.short_description = '외부 식별자'

    def extra_data_status(self, obj: SocialAuth):
        return AdminDisplayService.boolean_badge(
            True,
            true_text='보호됨',
        )
    extra_data_status.short_description = '제공자 원본 데이터'

    @admin.action(
        description='선택한 소셜 로그인 연동 해제',
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
                    '해제할 소셜 로그인 연동이 없습니다.',
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                queryset,
                action_name='disconnect_social_auth',
                title='소셜 로그인 연동 해제 확인',
                warning=(
                    '선택한 외부 계정 연동이 삭제됩니다. 사용 가능한 '
                    '비밀번호나 다른 연동이 없는 계정은 해제하지 않습니다.'
                ),
                confirm_label='연동 해제',
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
            f'{disconnected}개의 소셜 로그인 연동을 해제했습니다.',
            level=messages.SUCCESS,
        )
        if failed:
            self.message_user(
                request,
                f'{failed}개는 로그인 수단을 보존하기 위해 해제하지 않았습니다.',
                level=messages.WARNING,
            )
        return None

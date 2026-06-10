from django.contrib import admin

from board.constants.social_auth import SUPPORTED_SOCIAL_AUTH_PROVIDERS
from board.models import TwoFactorAuth, SocialAuth, SocialAuthProvider
from board.services.social_auth_provider_service import SocialAuthProviderService


@admin.register(TwoFactorAuth)
class TwoFactorAuthAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_date']
    search_fields = ['user__username']
    list_filter = [('created_date', admin.DateFieldListFilter)]
    list_per_page = 30

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(SocialAuth)
class SocialAuthAdmin(admin.ModelAdmin):
    list_display = ['user', 'provider', 'created_date']
    search_fields = ['user__username', 'provider__key']
    list_filter = ['provider', ('created_date', admin.DateFieldListFilter)]
    list_per_page = 30

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'provider', 'uid']
        return super().get_form(request, obj, **kwargs)


@admin.register(SocialAuthProvider)
class SocialAuthProviderAdmin(admin.ModelAdmin):
    list_display = ['key', 'is_enabled', 'has_client_id', 'has_client_secret']
    list_editable = ['is_enabled']
    readonly_fields = ['key']
    fields = ['key', 'is_enabled', 'client_id', 'client_secret']

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_queryset(self, request):
        SocialAuthProviderService.ensure_supported_providers()
        return super().get_queryset(request).filter(
            key__in=SUPPORTED_SOCIAL_AUTH_PROVIDERS.keys()
        )

    @admin.display(boolean=True, description='Client ID')
    def has_client_id(self, obj):
        return bool(obj.client_id)

    @admin.display(boolean=True, description='Client Secret')
    def has_client_secret(self, obj):
        return bool(obj.client_secret)

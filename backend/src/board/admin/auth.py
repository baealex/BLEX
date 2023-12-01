from django.contrib import admin

from board.models import TwoFactorAuth, SocialAuth, SocialAuthProvider


@admin.register(TwoFactorAuth)
class TwoFactorAuthAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(SocialAuth)
class SocialAuthAdmin(admin.ModelAdmin):
    list_display = ['user', 'provider', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'provider', 'uid']
        return super().get_form(request, obj, **kwargs)


@admin.register(SocialAuthProvider)
class SocialAuthProviderAdmin(admin.ModelAdmin):
    list_display = ['key', 'name', 'icon', 'color']
    list_editable = ['name', 'icon', 'color']
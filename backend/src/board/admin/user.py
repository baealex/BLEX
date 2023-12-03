from django import forms
from django.contrib import admin
from django.urls import reverse

from board.models import (
    UserConfigMeta, UserLinkMeta, Config, Follow, UsernameChangeLog,
    EmailChange,
)
from board.constants.config_meta import CONFIG_TYPES

from .service import AdminDisplayService, AdminLinkService


admin.site.register(EmailChange)
admin.site.register(UsernameChangeLog)


@admin.register(UserConfigMeta)
class UserConfigMetaAdmin(admin.ModelAdmin):
    class UserConfigMetaForm(forms.ModelForm):
        class Meta:
            model = UserConfigMeta
            fields = '__all__'
            widgets = {
                'name': forms.Select(
                    choices=[
                        (config_type, config_type) for config_type in CONFIG_TYPES
                    ],
                ),
            }
    form = UserConfigMetaForm

    def get_form(self, request, obj=None, **kwargs):
        if obj:
            kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)

    list_display = ['user_link', 'name', 'value']
    list_display_links = ['name']
    list_filter = ['name']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = 'user'


@admin.register(UserLinkMeta)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'value']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Preview', {
            'fields': ('configs_preview',),
        }),
    )
    readonly_fields = ['configs_preview']

    def configs_preview(self, obj):
        configs = obj.user.conf_meta.all()
        return AdminDisplayService.html(f"""
                <ul>
                    {"".join([f'<li><a href="{reverse("admin:board_userconfigmeta_change", args=[config.id])}">{config.name} ({config.value})</a></li>' for config in configs])}
                </ul>
            """
        )

    list_display = ['user']
    list_per_page = 30


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ['id', 'to_link', 'from_link', 'created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('following', 'follower', 'following__user')

    def to_link(self, obj):
        return AdminLinkService.create_user_link(obj.following.user)
    to_link.short_description = 'to'

    def from_link(self, obj):
        return AdminLinkService.create_user_link(obj.follower)
    from_link.short_description = 'from'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['following', 'follower']
        return super().get_form(request, obj, **kwargs)

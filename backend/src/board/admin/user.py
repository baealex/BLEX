from django import forms
from django.contrib import admin
from django.urls import reverse

from board.models import (
    UserConfigMeta, UserLinkMeta, Config, UsernameChangeLog,
    EmailChange, Profile
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
class UserLinkMetaAdmin(admin.ModelAdmin):
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


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'role', 'analytics_share_url_status']
    list_filter = ['role']
    search_fields = ['user__username', 'user__email']
    list_per_page = 30

    fieldsets = (
        ('사용자 정보', {
            'fields': ('user',)
        }),
        ('권한 설정', {
            'fields': ('role',),
            'description': '편집자: 글 작성 및 통계 접근 가능, 독자: 읽기만 가능'
        }),
        ('프로필 정보', {
            'fields': ('bio', 'homepage', 'cover', 'avatar'),
        }),
        ('소개 페이지', {
            'fields': ('about_md', 'about_html'),
            'classes': ('collapse',),
        }),
        ('통계 설정', {
            'fields': ('analytics_share_url',),
            'classes': ('collapse',),
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def analytics_share_url_status(self, obj):
        if obj.analytics_share_url:
            return '✓ 설정됨'
        return '✗ 미설정'
    analytics_share_url_status.short_description = '통계 URL'

    def get_form(self, request, obj=None, **kwargs):
        return super().get_form(request, obj, **kwargs)

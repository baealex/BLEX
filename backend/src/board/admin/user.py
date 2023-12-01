from django.contrib import admin
from django.db.models import F
from django.urls import reverse
from django.utils.safestring import mark_safe

from board.models import (
    UserConfigMeta, UserLinkMeta, Config, Follow, UsernameChangeLog,
    EmailChange,
)

from .service import AdminLinkService


admin.site.register(EmailChange)
admin.site.register(UsernameChangeLog)


@admin.register(UserConfigMeta)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['user_link', 'name', 'value']
    list_display_links = ['name']
    list_filter = ['name']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = 'user'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['widgets'] = {
            'name': admin.widgets.AdminTextInputWidget,
        }
        return super().get_form(request, obj, **kwargs)


@admin.register(UserLinkMeta)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'value']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
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

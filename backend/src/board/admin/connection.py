from django.contrib import admin

from board.models import (
    TelegramSync, OpenAIConnection, OpenAIUsageHistory
)

from .service import AdminLinkService, AdminDisplayService


@admin.register(TelegramSync)
class TelegramSyncAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', 'synced', 'created_date']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = 'user'

    def synced(self, obj: TelegramSync):
        return AdminDisplayService.check_mark(obj.tid)

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(OpenAIConnection)
class OpenAIConnectionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', 'created_date']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = 'user'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'api_key']
        return super().get_form(request, obj, **kwargs)


@admin.register(OpenAIUsageHistory)
class OpenAIUsageHistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', 'query_size', 'response_size', 'created_date']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')
    
    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = 'user'

    def query_size(self, obj):
        return len(obj.query)

    def response_size(self, obj):
        return len(obj.response)

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)
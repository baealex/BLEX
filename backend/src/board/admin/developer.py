from django.contrib import admin

from board.models import (
    DeveloperToken,
    DeveloperRequestLog,
    DeveloperWebhook,
    DeveloperWebhookLog,
)


@admin.register(DeveloperToken)
class DeveloperTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'token']
        return super().get_form(request, obj, **kwargs)


@admin.register(DeveloperRequestLog)
class DeveloperRequestLogAdmin(admin.ModelAdmin):
    list_display = ['developer', 'endpoint', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(DeveloperWebhook)
class DeveloperWebhookAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'provider', 'is_active', 'created_date']
    list_filter = ['provider', 'is_active', 'created_date']
    search_fields = ['name', 'user__username', 'url']
    readonly_fields = ['created_date', 'updated_date']


@admin.register(DeveloperWebhookLog)
class DeveloperWebhookLogAdmin(admin.ModelAdmin):
    list_display = ['webhook', 'event', 'status_code', 'retry_count', 'created_date']
    list_filter = ['event', 'status_code', 'created_date']
    search_fields = ['webhook__name', 'event']
    readonly_fields = ['created_date']
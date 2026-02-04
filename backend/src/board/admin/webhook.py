from django.contrib import admin

from board.models import WebhookSubscription


@admin.register(WebhookSubscription)
class WebhookSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['name', 'author', 'is_active', 'failure_count', 'last_success_date', 'created_date']
    list_filter = ['is_active', 'failure_count', 'created_date']
    search_fields = ['name', 'author__user__username', 'webhook_url']
    readonly_fields = ['created_date', 'failure_count', 'last_success_date']
    actions = ['reset_failure_count', 'activate_subscriptions']

    @admin.action(description='Reset failure count and reactivate selected subscriptions')
    def reset_failure_count(self, request, queryset):
        queryset.update(failure_count=0, is_active=True)
        self.message_user(request, f'{queryset.count()} subscriptions reset and reactivated.')

    @admin.action(description='Activate selected subscriptions')
    def activate_subscriptions(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, f'{queryset.count()} subscriptions activated.')

from django.contrib import admin

from board.models import WebhookSubscription


@admin.register(WebhookSubscription)
class WebhookSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['name', 'author', 'is_active', 'failure_count', 'last_success_date', 'created_date']
    list_filter = ['is_active', 'failure_count', ('created_date', admin.DateFieldListFilter)]
    search_fields = ['name', 'author__user__username', 'webhook_url']
    readonly_fields = ['created_date', 'failure_count', 'last_success_date']
    list_per_page = 30
    actions = ['reset_failure_count', 'activate_subscriptions']

    @admin.action(description='실패 횟수 초기화 및 재활성화')
    def reset_failure_count(self, request, queryset):
        queryset.update(failure_count=0, is_active=True)
        self.message_user(request, f'{queryset.count()}개의 웹훅을 초기화하고 재활성화했습니다.')

    @admin.action(description='선택한 웹훅 활성화')
    def activate_subscriptions(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, f'{queryset.count()}개의 웹훅을 활성화했습니다.')

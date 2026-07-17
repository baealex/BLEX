from typing import Any

from django.contrib import admin, messages
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest

from board.models import WebhookSubscription
from board.services.webhook_subscription_state_service import (
    WebhookSubscriptionStateService,
)

from .action_confirmation import render_action_confirmation


@admin.register(WebhookSubscription)
class WebhookSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['name', 'scope', 'author', 'is_active', 'failure_count', 'last_success_date', 'created_date']
    list_filter = ['scope', 'is_active', 'failure_count', ('created_date', admin.DateFieldListFilter)]
    search_fields = ['name', 'author__user__username', 'webhook_url']
    readonly_fields = [
        'created_date',
        'failure_count',
        'last_success_date',
    ]
    list_per_page = 30
    actions = [
        'reset_failure_count',
        'activate_subscriptions',
        'deactivate_subscriptions',
    ]

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            readonly_fields.append('is_active')
        return readonly_fields

    def set_subscription_state(
        self,
        request: HttpRequest,
        queryset: QuerySet[WebhookSubscription],
        *,
        is_active: bool,
        reset_failure_count: bool = False,
    ) -> int:
        with transaction.atomic():
            subscriptions = list(queryset.select_for_update())
            for subscription in subscriptions:
                WebhookSubscriptionStateService.set_active(
                    subscription,
                    is_active=is_active,
                    reset_failure_count=reset_failure_count,
                )
                if reset_failure_count:
                    change_message = (
                        'Admin에서 실패 횟수 초기화 및 웹훅 재활성화'
                    )
                elif is_active:
                    change_message = 'Admin에서 웹훅 활성화'
                else:
                    change_message = 'Admin에서 웹훅 비활성화'
                self.log_change(
                    request,
                    subscription,
                    change_message,
                )
        return len(subscriptions)

    @admin.action(
        description='실패 횟수 초기화 및 재활성화',
        permissions=['change'],
    )
    def reset_failure_count(
        self,
        request: HttpRequest,
        queryset: QuerySet[WebhookSubscription],
    ) -> Any:
        targets = queryset.exclude(is_active=True, failure_count=0)
        if request.POST.get('confirm') != 'yes':
            if not targets.exists():
                self.message_user(
                    request,
                    '초기화하거나 재활성화할 웹훅이 없습니다.',
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                targets,
                action_name='reset_failure_count',
                title='웹훅 실패 상태 초기화 확인',
                warning=(
                    '실패 횟수를 0으로 초기화하고 외부 URL 전송을 다시 '
                    '활성화합니다.'
                ),
                confirm_label='초기화 및 재활성화',
            )

        count = self.set_subscription_state(
            request,
            targets,
            is_active=True,
            reset_failure_count=True,
        )
        self.message_user(
            request,
            f'{count}개의 웹훅을 초기화하고 재활성화했습니다.',
            level=messages.SUCCESS,
        )
        return None

    @admin.action(
        description='선택한 웹훅 활성화',
        permissions=['change'],
    )
    def activate_subscriptions(
        self,
        request: HttpRequest,
        queryset: QuerySet[WebhookSubscription],
    ) -> Any:
        targets = queryset.filter(is_active=False)
        if request.POST.get('confirm') != 'yes':
            if not targets.exists():
                self.message_user(
                    request,
                    '활성화할 웹훅이 없습니다.',
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                targets,
                action_name='activate_subscriptions',
                title='웹훅 활성화 확인',
                warning=(
                    '선택한 웹훅의 외부 URL로 다음 포스트 알림부터 '
                    '전송을 다시 시작합니다. 실패 횟수는 유지됩니다.'
                ),
                confirm_label='웹훅 활성화',
            )

        count = self.set_subscription_state(
            request,
            targets,
            is_active=True,
        )
        self.message_user(
            request,
            f'{count}개의 웹훅을 활성화했습니다.',
            level=messages.SUCCESS,
        )
        return None

    @admin.action(
        description='선택한 웹훅 비활성화',
        permissions=['change'],
    )
    def deactivate_subscriptions(
        self,
        request: HttpRequest,
        queryset: QuerySet[WebhookSubscription],
    ) -> None:
        count = self.set_subscription_state(
            request,
            queryset.filter(is_active=True),
            is_active=False,
        )
        self.message_user(
            request,
            f'{count}개의 웹훅을 비활성화했습니다.',
            level=messages.SUCCESS,
        )

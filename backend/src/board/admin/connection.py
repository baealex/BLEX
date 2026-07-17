from django.contrib import admin
from django.db.models import BooleanField, Case, Value, When

from board.models import TelegramSync

from .mixins import ServiceOwnedRecordAdminMixin
from .service import AdminDisplayService, AdminLinkService


@admin.register(TelegramSync)
class TelegramSyncAdmin(ServiceOwnedRecordAdminMixin, admin.ModelAdmin):
    list_display = [
        'id',
        'user_link',
        'synced',
        'token_status',
        'created_date',
    ]
    search_fields = ['user__username']
    list_filter = [('created_date', admin.DateFieldListFilter)]
    fields = [
        'user_link',
        'synced',
        'token_status',
        'auth_token_exp',
        'created_date',
    ]
    readonly_fields = fields
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user').defer(
            'tid',
            'auth_token',
            'user__password',
        ).annotate(
            telegram_linked=Case(
                When(tid='', then=Value(False)),
                default=Value(True),
                output_field=BooleanField(),
            ),
            pending_auth_token=Case(
                When(auth_token='', then=Value(False)),
                default=Value(True),
                output_field=BooleanField(),
            ),
        )

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = '사용자'

    def synced(self, obj: TelegramSync):
        return AdminDisplayService.boolean_badge(
            obj.telegram_linked,
            true_text='연동됨',
            false_text='연동 대기',
        )
    synced.short_description = '연동 상태'
    synced.admin_order_field = 'tid'

    def token_status(self, obj: TelegramSync):
        return AdminDisplayService.boolean_badge(
            obj.pending_auth_token,
            true_text='발급됨',
            false_text='없음',
        )
    token_status.short_description = '인증 토큰'
    token_status.admin_order_field = 'auth_token'

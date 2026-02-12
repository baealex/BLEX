from django.contrib import admin

from board.models import TelegramSync

from .service import AdminLinkService, AdminDisplayService


@admin.register(TelegramSync)
class TelegramSyncAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', 'synced', 'created_date']
    search_fields = ['user__username']
    list_filter = [('created_date', admin.DateFieldListFilter)]
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = '사용자'

    def synced(self, obj: TelegramSync):
        return AdminDisplayService.check_mark(obj.tid)
    synced.short_description = '연동 상태'

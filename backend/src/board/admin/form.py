from django.contrib import admin

from board.models import Form

from .mixins import ReadOnlyRecordAdminMixin
from .service import AdminLinkService


@admin.register(Form)
class FormAdmin(ReadOnlyRecordAdminMixin, admin.ModelAdmin):
    list_display = [
        'id',
        'user_link',
        'title',
        'is_public',
        'created_date',
        'updated_date',
    ]
    list_per_page = 30
    search_fields = ['title', 'user__username']
    list_filter = ['is_public', ('created_date', admin.DateFieldListFilter)]
    fields = [
        'user_link',
        'title',
        'content',
        'is_public',
        'created_date',
        'updated_date',
    ]
    readonly_fields = fields

    def get_queryset(self, request):
        queryset = super().get_queryset(request).select_related('user')
        if (
            getattr(request, 'resolver_match', None)
            and request.resolver_match.url_name == 'board_form_changelist'
        ):
            return queryset.defer('content')
        return queryset

    def has_delete_permission(self, request, obj=None):
        return False

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = '사용자'

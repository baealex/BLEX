from .auth import *
from .banner import *
from .comment import *
from .connection import *
from .webhook import *
from .form import *
from .image import *
from .notify import *
from .revision import *
from .series import *
from .post import *
from .tag import *
from .user import *
from django.contrib import admin
from django.contrib.admin.models import LogEntry

from .mixins import is_admin_changelist_request


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ['action_time', 'user', 'content_type', 'object_repr', 'action_flag']
    list_filter = ['action_flag', 'content_type', ('action_time', admin.DateFieldListFilter)]
    search_fields = ['object_repr', 'user__username']
    readonly_fields = ['action_time', 'user', 'content_type', 'object_id', 'object_repr', 'action_flag', 'change_message']
    list_per_page = 50
    show_full_result_count = False
    date_hierarchy = 'action_time'

    def get_queryset(self, request):
        queryset = super().get_queryset(request).select_related(
            'user',
            'content_type',
        ).defer('user__password')
        if is_admin_changelist_request(request, self.model):
            return queryset.defer('change_message')
        return queryset

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

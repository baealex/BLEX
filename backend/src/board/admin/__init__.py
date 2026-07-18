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
from django.db.models.functions import Substr
from django.utils.text import Truncator
from django.utils.translation import gettext_lazy as _

from board.services.utility_cleanup_audit_service import UtilityCleanupAuditService

from .mixins import is_admin_changelist_request


class AuditRecordTypeFilter(admin.SimpleListFilter):
    title = _('Record type')
    parameter_name = 'record_type'

    def lookups(self, request, model_admin):
        return [
            ('utility', _('Utility execution')),
            ('admin', _('Other admin activity')),
        ]

    def queryset(self, request, queryset):
        utility_lookup = {
            'content_type__app_label': 'admin',
            'content_type__model': 'logentry',
            'object_repr': UtilityCleanupAuditService.OBJECT_REPR,
        }
        if self.value() == 'utility':
            return queryset.filter(**utility_lookup)
        if self.value() == 'admin':
            return queryset.exclude(**utility_lookup)
        return queryset


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    change_message_preview_length = 200
    utility_action_labels = {
        'Started unused image cleanup': _('Started unused image cleanup'),
        'Executed unused tag cleanup': _('Executed unused tag cleanup'),
        'Executed session cleanup': _('Executed session cleanup'),
        'Executed expired log cleanup': _('Executed expired log cleanup'),
        'Executed unused image cleanup': _('Executed unused image cleanup'),
    }
    list_display = [
        'action_time',
        'user',
        'record_type',
        'target',
        'action_details',
    ]
    list_filter = [
        AuditRecordTypeFilter,
        'action_flag',
        'content_type',
        ('action_time', admin.DateFieldListFilter),
    ]
    search_fields = ['object_repr', 'change_message', 'user__username']
    readonly_fields = [
        'action_time',
        'user',
        'content_type',
        'object_id',
        'object_repr',
        'action_flag',
        'display_change_message',
    ]
    list_per_page = 50
    show_full_result_count = False
    date_hierarchy = 'action_time'

    def get_queryset(self, request):
        queryset = super().get_queryset(request).select_related(
            'user',
            'content_type',
        ).defer('user__password')
        if is_admin_changelist_request(request, self.model):
            return queryset.annotate(
                change_message_preview=Substr(
                    'change_message',
                    1,
                    self.change_message_preview_length,
                ),
            ).defer('change_message')
        return queryset

    @staticmethod
    def is_utility_entry(obj: LogEntry) -> bool:
        content_type = obj.content_type
        return (
            content_type is not None
            and content_type.app_label == 'admin'
            and content_type.model == 'logentry'
            and obj.object_repr == UtilityCleanupAuditService.OBJECT_REPR
        )

    @classmethod
    def format_change_message(cls, change_message: str) -> str:
        if not change_message:
            return '-'

        if utility_label := cls.utility_action_labels.get(change_message):
            return str(utility_label)

        if change_message.startswith('['):
            formatted_message = LogEntry(
                change_message=change_message,
            ).get_change_message()
            if formatted_message == change_message:
                return str(_('Detailed field changes'))
            return formatted_message

        return change_message

    @admin.display(description=_('Record type'), ordering='content_type')
    def record_type(self, obj: LogEntry) -> str:
        if self.is_utility_entry(obj):
            return str(_('Utility execution'))
        return str(obj.content_type or '-')

    @admin.display(description=_('Target'), ordering='object_repr')
    def target(self, obj: LogEntry) -> str:
        if self.is_utility_entry(obj):
            return str(_('System utilities'))
        return obj.object_repr

    @admin.display(description=_('Action details'))
    def action_details(self, obj: LogEntry) -> str:
        if hasattr(obj, 'change_message_preview'):
            change_message = obj.change_message_preview
        else:
            change_message = obj.change_message
        return Truncator(
            self.format_change_message(change_message),
        ).chars(100)

    @admin.display(description=_('Action details'))
    def display_change_message(self, obj: LogEntry) -> str:
        return self.format_change_message(obj.change_message)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

"""Django Admin configuration for immutable post revision snapshots."""

from typing import Any

from django.contrib import admin, messages
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from board.models import EditHistory
from board.services.post_revision_service import PostRevisionService

from .action_confirmation import render_action_confirmation
from .constants import LIST_PER_PAGE_DEFAULT
from .mixins import is_admin_changelist_request
from .service import AdminDisplayService, AdminLinkService


class RevisionPostStatusFilter(admin.SimpleListFilter):
    """Filter revision snapshots by the current lifecycle of their post."""

    title = _('Post status')
    parameter_name = 'post_status'

    def lookups(self, request, model_admin):
        return [
            ('active', _('Active')),
            ('trashed', _('Trash')),
        ]

    def queryset(self, request, queryset):
        if self.value() == 'active':
            return queryset.filter(post__deleted_date__isnull=True)
        if self.value() == 'trashed':
            return queryset.filter(post__deleted_date__isnull=False)
        return queryset


@admin.register(EditHistory)
class EditHistoryAdmin(admin.ModelAdmin):
    """Expose revision snapshots without allowing their content to be edited."""

    list_display = [
        'id',
        'post_link',
        'post_status',
        'change_type_label',
        'actor_link',
        'snapshot_summary',
        'source_updated_date',
        'created_date',
    ]
    list_display_links = ['id']
    list_filter = [
        RevisionPostStatusFilter,
        'change_type',
        ('created_date', admin.DateFieldListFilter),
    ]
    search_fields = [
        'post__title',
        'post__url',
        'post__author__username',
        'actor__username',
        'title',
        'content_excerpt',
    ]
    readonly_fields = [
        'post',
        'actor',
        'restored_from',
        'change_type',
        'title',
        'subtitle',
        'content',
        'content_excerpt',
        'description',
        'tags',
        'source_updated_date',
        'created_date',
    ]
    fieldsets = (
        (_('Revision information'), {
            'fields': (
                'post',
                'actor',
                'change_type',
                'restored_from',
            ),
        }),
        (_('Previous snapshot'), {
            'fields': (
                'title',
                'subtitle',
                'content',
                'description',
                'tags',
            ),
        }),
        (_('Record timestamps'), {
            'fields': (
                'content_excerpt',
                'source_updated_date',
                'created_date',
            ),
            'classes': ('collapse',),
        }),
    )
    actions = ['delete_revisions']
    ordering = ['-created_date', '-id']
    date_hierarchy = 'created_date'
    list_per_page = LIST_PER_PAGE_DEFAULT
    show_full_result_count = False

    def get_queryset(self, request):
        is_changelist = is_admin_changelist_request(request, self.model)
        relations = [
            'post',
            'post__author',
            'actor',
        ]
        if not is_changelist:
            relations.append('restored_from')
        queryset = super().get_queryset(request).select_related(
            *relations,
        ).defer(
            'post__author__password',
            'actor__password',
        )
        if is_changelist:
            return queryset.defer(
                'content',
                'description',
                'tags',
                'subtitle',
            )
        return queryset

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop('delete_selected', None)
        return actions

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        if obj is not None:
            return False
        return super().has_change_permission(request, obj)

    def post_link(self, obj: EditHistory):
        return AdminLinkService.create_post_link(obj.post)
    post_link.short_description = _('Post')
    post_link.admin_order_field = 'post__title'

    def post_status(self, obj: EditHistory):
        return AdminDisplayService.publish_status_badge(obj.post)
    post_status.short_description = _('Current status')
    post_status.admin_order_field = 'post__deleted_date'

    def change_type_label(self, obj: EditHistory) -> str:
        return obj.get_change_type_display()
    change_type_label.short_description = _('Change type')
    change_type_label.admin_order_field = 'change_type'

    def actor_link(self, obj: EditHistory):
        return AdminLinkService.create_user_link(obj.actor)
    actor_link.short_description = _('Actor')
    actor_link.admin_order_field = 'actor__username'

    def snapshot_summary(self, obj: EditHistory):
        excerpt = obj.content_excerpt or _('No content excerpt')
        return format_html(
            '<strong>{}</strong><br><span>{}</span>',
            obj.title,
            excerpt,
        )
    snapshot_summary.short_description = _('Previous content')
    snapshot_summary.admin_order_field = 'title'

    def delete_model(self, request, obj: EditHistory) -> None:
        PostRevisionService.delete_revision(obj.post, obj)

    @admin.action(
        description=_('Delete selected revisions'),
        permissions=['delete'],
    )
    def delete_revisions(
        self,
        request: HttpRequest,
        queryset: QuerySet[EditHistory],
    ) -> Any:
        if request.POST.get('confirm') != 'yes':
            if not queryset.exists():
                self.message_user(
                    request,
                    _('There are no revisions to delete.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                queryset,
                action_name='delete_revisions',
                title=_('Confirm revision deletion'),
                warning=_(
                    'Only the selected previous snapshots will be deleted. '
                    'The current post content will not change, but deleted '
                    'revisions cannot be recovered.'
                ),
                confirm_label=_('Delete revisions'),
            )

        revisions = list(queryset.select_related('post'))
        if not revisions:
            self.message_user(
                request,
                _('There are no revisions to delete.'),
                level=messages.WARNING,
            )
            return None

        revision_ids = [revision.pk for revision in revisions]
        with transaction.atomic():
            self.log_deletions(
                request,
                EditHistory.objects.filter(pk__in=revision_ids),
            )
            for revision in revisions:
                PostRevisionService.delete_revision(
                    revision.post,
                    revision,
                )

        count = len(revisions)
        self.message_user(
            request,
            ngettext(
                '%(count)d revision was deleted.',
                '%(count)d revisions were deleted.',
                count,
            ) % {'count': count},
            level=messages.SUCCESS,
        )
        return None

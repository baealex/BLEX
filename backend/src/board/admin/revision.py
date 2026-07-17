"""Django Admin configuration for immutable post revision snapshots."""

from typing import Any

from django.contrib import admin, messages
from django.db import transaction
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils.html import format_html

from board.models import EditHistory
from board.services.post_revision_service import PostRevisionService

from .action_confirmation import render_action_confirmation
from .constants import LIST_PER_PAGE_DEFAULT
from .service import AdminDisplayService, AdminLinkService


class RevisionPostStatusFilter(admin.SimpleListFilter):
    """Filter revision snapshots by the current lifecycle of their post."""

    title = '포스트 상태'
    parameter_name = 'post_status'

    def lookups(self, request, model_admin):
        return [
            ('active', '활성'),
            ('trashed', '휴지통'),
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
        ('이력 정보', {
            'fields': (
                'post',
                'actor',
                'change_type',
                'restored_from',
            ),
        }),
        ('이전 스냅샷', {
            'fields': (
                'title',
                'subtitle',
                'content',
                'description',
                'tags',
            ),
        }),
        ('기록 시점', {
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

    def get_queryset(self, request):
        queryset = super().get_queryset(request).select_related(
            'post',
            'post__author',
            'actor',
            'restored_from',
        )
        if (
            getattr(request, 'resolver_match', None)
            and request.resolver_match.url_name
            == 'board_edithistory_changelist'
        ):
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
    post_link.short_description = '포스트'
    post_link.admin_order_field = 'post__title'

    def post_status(self, obj: EditHistory):
        return AdminDisplayService.publish_status_badge(obj.post)
    post_status.short_description = '현재 상태'
    post_status.admin_order_field = 'post__deleted_date'

    def change_type_label(self, obj: EditHistory) -> str:
        return obj.get_change_type_display()
    change_type_label.short_description = '변경 유형'
    change_type_label.admin_order_field = 'change_type'

    def actor_link(self, obj: EditHistory):
        return AdminLinkService.create_user_link(obj.actor)
    actor_link.short_description = '작업자'
    actor_link.admin_order_field = 'actor__username'

    def snapshot_summary(self, obj: EditHistory):
        excerpt = obj.content_excerpt or '본문 요약 없음'
        return format_html(
            '<strong>{}</strong><br><span>{}</span>',
            obj.title,
            excerpt,
        )
    snapshot_summary.short_description = '이전 내용'
    snapshot_summary.admin_order_field = 'title'

    def delete_model(self, request, obj: EditHistory) -> None:
        PostRevisionService.delete_revision(obj.post, obj)

    @admin.action(
        description='선택한 수정 이력 삭제',
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
                    '삭제할 수정 이력이 없습니다.',
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                queryset,
                action_name='delete_revisions',
                title='수정 이력 삭제 확인',
                warning=(
                    '선택한 이전 스냅샷만 삭제됩니다. 현재 포스트 내용은 '
                    '바뀌지 않지만 삭제한 이력은 복구할 수 없습니다.'
                ),
                confirm_label='수정 이력 삭제',
            )

        revisions = list(queryset.select_related('post'))
        if not revisions:
            self.message_user(
                request,
                '삭제할 수정 이력이 없습니다.',
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

        self.message_user(
            request,
            f'{len(revisions)}개의 수정 이력을 삭제했습니다.',
            level=messages.SUCCESS,
        )
        return None

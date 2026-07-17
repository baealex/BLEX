import re
from html import unescape
from typing import Any

from django.contrib import admin, messages
from django.db import transaction
from django.db.models import (
    Count,
    IntegerField,
    OuterRef,
    QuerySet,
    Subquery,
    Value,
)
from django.db.models.functions import Coalesce
from django.http import HttpRequest
from django.template.defaultfilters import truncatewords
from django.utils.html import strip_tags, format_html
from django.utils.safestring import mark_safe

from board.models import Comment
from board.services.comment_service import CommentService

from .action_confirmation import render_action_confirmation
from .mixins import (
    ConfirmedActionDeleteAdminMixin,
    ReadOnlyRecordAdminMixin,
    is_admin_changelist_request,
)
from .service import AdminDisplayService, AdminLinkService
from .constants import COLOR_MUTED, COLOR_DARKENED_BG, COLOR_WARNING, COLOR_DANGER, COLOR_TEXT, COLOR_BG, COLOR_BORDER


@admin.register(Comment)
class CommentAdmin(
    ConfirmedActionDeleteAdminMixin,
    ReadOnlyRecordAdminMixin,
    admin.ModelAdmin,
):
    autocomplete_fields = ['post']
    search_fields = ['text_md', 'author__username', 'post__title']

    list_filter = [
        'edited',
        'heart',
        ('created_date', admin.DateFieldListFilter),
    ]

    actions = ['mark_as_heart', 'unmark_as_heart', 'soft_delete_comments']

    fieldsets = (
        ('기본 정보', {
            'fields': ('author', 'post', 'parent', 'author_info')
        }),
        ('내용', {
            'fields': ('text_md', 'text_html', 'edited', 'heart')
        }),
        ('미리보기', {
            'fields': ('text_html_preview',),
        }),
        ('통계', {
            'fields': ('likes_count', 'created_at'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = [
        'author',
        'post',
        'parent',
        'author_info',
        'text_md',
        'text_html',
        'edited',
        'heart',
        'text_html_preview',
        'likes_count',
        'created_at',
    ]

    def text_html_preview(self, obj):
        content_with_breaks = re.sub(
            r'<\s*br\s*/?\s*>',
            '\n',
            obj.text_html,
            flags=re.IGNORECASE,
        )
        content_with_breaks = re.sub(
            r'</\s*(?:p|div|li)\s*>',
            '\n',
            content_with_breaks,
            flags=re.IGNORECASE,
        )
        return format_html(
            '<div style="white-space: pre-wrap;">{}</div>',
            unescape(strip_tags(content_with_breaks)).strip(),
        )
    text_html_preview.short_description = '텍스트 미리보기'

    list_display = ['id', 'content_preview', 'post_link', 'author_link', 'likes_display', 'status_badges', 'created_date']
    list_display_links = ['content_preview']
    list_per_page = 30
    show_full_result_count = False
    save_on_top = True
    date_hierarchy = 'created_date'

    def get_queryset(self, request):
        like_counts = Comment.likes.through.objects.filter(
            comment_id=OuterRef('pk'),
        ).order_by().values('comment_id').annotate(
            total=Count('pk'),
        ).values('total')
        queryset = super().get_queryset(request).select_related(
            'author',
            'post',
        ).defer('author__password').annotate(
            likes_count_annotated=Coalesce(
                Subquery(like_counts, output_field=IntegerField()),
                Value(0),
            )
        )
        if is_admin_changelist_request(request, self.model):
            return queryset.defer('text_md')
        return queryset

    def author_link(self, obj):
        if obj.author:
            return AdminLinkService.create_user_link(obj.author)
        return format_html('<span style="color: {};">Ghost</span>', COLOR_MUTED)
    author_link.short_description = '작성자'

    def post_link(self, obj):
        return AdminLinkService.create_post_link(obj.post)
    post_link.short_description = '포스트'

    def content_preview(self, obj):
        content = truncatewords(strip_tags(obj.get_text_html()), 8)
        if not obj.author:
            return format_html('<span style="color: {}; font-style: italic;">[삭제됨] {}</span>', COLOR_MUTED, content)
        return content
    content_preview.short_description = '내용'

    def likes_display(self, obj):
        count = obj.likes_count_annotated if hasattr(obj, 'likes_count_annotated') else obj.likes.count()
        if count > 0:
            return format_html('❤️ {}', count)
        return format_html('<span style="color: {};">0</span>', COLOR_MUTED)
    likes_display.short_description = '좋아요'
    likes_display.admin_order_field = 'likes_count_annotated'

    def status_badges(self, obj):
        badges = []
        if obj.edited:
            badges.append(format_html(
                '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">수정됨</span>',
                COLOR_WARNING, COLOR_TEXT
            ))
        if obj.heart:
            badges.append(format_html(
                '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">❤️ 하트</span>',
                COLOR_DANGER, COLOR_BG
            ))
        if not obj.author:
            badges.append(format_html(
                '<span style="background: {}; color: {}; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0.8;">삭제됨</span>',
                COLOR_DARKENED_BG, COLOR_TEXT
            ))
        return mark_safe(' '.join(str(b) for b in badges)) if badges else format_html('<span style="color: {};">-</span>', COLOR_MUTED)
    status_badges.short_description = '상태'

    def author_info(self, obj):
        if not obj.author:
            return format_html('<p style="color: {};">삭제된 사용자</p>', COLOR_MUTED)
        return format_html(
            '<div style="background: {}; padding: 12px; border-radius: 6px; border: 1px solid {};">'
            '<p style="margin: 4px 0; color: {};"><strong>사용자명:</strong> {}</p>'
            '<p style="margin: 4px 0; color: {};"><strong>이메일:</strong> {}</p>'
            '</div>',
            COLOR_DARKENED_BG, COLOR_BORDER,
            COLOR_TEXT, obj.author.username,
            COLOR_TEXT, obj.author.email or '-'
        )
    author_info.short_description = '작성자 정보'

    def likes_count(self, obj):
        if hasattr(obj, 'likes_count_annotated'):
            return obj.likes_count_annotated
        return obj.likes.count()
    likes_count.short_description = '총 좋아요 수'

    def created_at(self, obj):
        return obj.created_date.strftime('%Y-%m-%d %H:%M:%S')
    created_at.short_description = '작성일시'

    def set_heart_status(
        self,
        request: HttpRequest,
        queryset: QuerySet[Comment],
        *,
        heart: bool,
    ) -> int:
        with transaction.atomic():
            comments = list(
                queryset.select_for_update().exclude(heart=heart),
            )
            status_label = '하트 표시' if heart else '하트 해제'
            for comment in comments:
                comment.heart = heart
                comment.save(update_fields=['heart'])
                self.log_change(
                    request,
                    comment,
                    f'Admin에서 {status_label}',
                )
        return len(comments)

    @admin.action(
        description='선택한 댓글을 하트로 표시',
        permissions=['change'],
    )
    def mark_as_heart(
        self,
        request: HttpRequest,
        queryset: QuerySet[Comment],
    ) -> None:
        count = self.set_heart_status(
            request,
            queryset,
            heart=True,
        )
        self.message_user(
            request,
            f'{count}개의 댓글을 하트로 표시했습니다.',
            level=messages.SUCCESS,
        )

    @admin.action(
        description='선택한 댓글의 하트 해제',
        permissions=['change'],
    )
    def unmark_as_heart(
        self,
        request: HttpRequest,
        queryset: QuerySet[Comment],
    ) -> None:
        count = self.set_heart_status(
            request,
            queryset,
            heart=False,
        )
        self.message_user(
            request,
            f'{count}개의 댓글의 하트를 해제했습니다.',
            level=messages.SUCCESS,
        )

    @admin.action(
        description='선택한 댓글을 삭제 상태로 전환',
        permissions=['delete'],
    )
    def soft_delete_comments(
        self,
        request: HttpRequest,
        queryset: QuerySet[Comment],
    ) -> Any:
        active_comments = queryset.filter(author__isnull=False)
        if request.POST.get('confirm') != 'yes':
            if not active_comments.exists():
                self.message_user(
                    request,
                    '삭제 상태로 전환할 댓글이 없습니다.',
                    level=messages.WARNING,
                )
                return None
            preview_comments = (
                active_comments.select_related(None)
                .defer(None)
                .only('pk', 'text_md')
            )
            return render_action_confirmation(
                request,
                self,
                preview_comments,
                action_name='soft_delete_comments',
                title='댓글 삭제 상태 전환 확인',
                warning=(
                    '댓글 행과 답글 관계는 유지되며 공개 화면에는 삭제된 '
                    '댓글로 표시됩니다. 작성자 연결은 복구할 수 없습니다.'
                ),
                confirm_label='댓글 삭제 상태로 전환',
            )

        with transaction.atomic():
            comments = list(
                active_comments.select_for_update().select_related(
                    'author',
                    'post',
                ),
            )
            for comment in comments:
                CommentService.delete_comment(comment)
                self.log_change(
                    request,
                    comment,
                    'Admin에서 댓글 삭제 상태로 전환',
                )

        self.message_user(
            request,
            f'{len(comments)}개의 댓글을 삭제 상태로 전환했습니다.',
            level=messages.SUCCESS,
        )
        return None

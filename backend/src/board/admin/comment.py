from django.contrib import admin
from django.utils.html import strip_tags, format_html
from django.utils.safestring import mark_safe
from django.template.defaultfilters import truncatewords
from django.db.models import Count, Q
from django.shortcuts import render
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.contrib import messages
import re

from board.models import Comment

from .service import AdminDisplayService, AdminLinkService
from .constants import COLOR_MUTED, COLOR_DARKENED_BG, COLOR_WARNING, COLOR_DANGER, COLOR_TEXT, COLOR_BG, COLOR_BORDER


class MentionMigrationFilter(admin.SimpleListFilter):
    """Filter for comments that need mention-to-reply migration"""
    title = '멘션 마이그레이션'
    parameter_name = 'mention_migration'

    def lookups(self, request, model_admin):
        return (
            ('needs_migration', '마이그레이션 필요 (백틱 멘션 있음)'),
            ('has_parent', '답글'),
            ('no_parent', '원댓글만'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'needs_migration':
            # Comments with backtick mentions and no parent
            return queryset.filter(
                text_md__contains='`@',
                parent__isnull=True
            )
        elif self.value() == 'has_parent':
            return queryset.filter(parent__isnull=False)
        elif self.value() == 'no_parent':
            return queryset.filter(parent__isnull=True)
        return queryset


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    autocomplete_fields = ['post']
    search_fields = ['text_md', 'author__username', 'post__title']

    list_filter = [
        MentionMigrationFilter,
        'edited',
        'heart',
        ('created_date', admin.DateFieldListFilter),
    ]

    actions = ['mark_as_heart', 'unmark_as_heart', 'delete_selected_comments', 'migrate_mentions_to_replies']

    fieldsets = (
        ('기본 정보', {
            'fields': ('author', 'post', 'author_info')
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
    readonly_fields = ['author', 'post', 'author_info', 'text_html_preview', 'likes_count', 'created_at']

    def text_html_preview(self, obj):
        return AdminDisplayService.html(
            obj.text_html,
            use_folding=True,
            remove_lazy_load=True,
        )
    text_html_preview.short_description = 'HTML 미리보기'

    list_display = ['id', 'content_preview', 'post_link', 'author_link', 'parent_display', 'likes_display', 'status_badges', 'created_date']
    list_display_links = ['content_preview']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author', 'post', 'parent', 'parent__author').prefetch_related('likes').annotate(
            likes_count_annotated=Count('likes', distinct=True)
        )

    def author_link(self, obj):
        if obj.author:
            return AdminLinkService.create_user_link(obj.author)
        return format_html('<span style="color: {};">Ghost</span>', COLOR_MUTED)
    author_link.short_description = '작성자'

    def post_link(self, obj):
        return AdminLinkService.create_post_link(obj.post)
    post_link.short_description = '포스트'

    def content_preview(self, obj):
        content = truncatewords(strip_tags(obj.text_html), 8)
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

    def parent_display(self, obj):
        if obj.parent:
            parent_author = obj.parent.author_username() if obj.parent.author else 'Ghost'
            parent_preview = truncatewords(strip_tags(obj.parent.text_html), 5)
            return format_html(
                '<span style="background: #e7f3ff; color: #1976D2; padding: 3px 8px; border-radius: 4px; font-size: 11px;">↳ @{}: {}</span>',
                parent_author,
                parent_preview
            )
        # Check if comment has backtick mention (migration candidate)
        if obj.parent is None and '`@' in obj.text_md:
            return format_html(
                '<span style="background: #fff3cd; color: #856404; padding: 3px 8px; border-radius: 4px; font-size: 11px;">⚠️ 멘션</span>'
            )
        return format_html('<span style="color: {};">-</span>', COLOR_MUTED)
    parent_display.short_description = '답글 상태'

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
        return obj.likes.count()
    likes_count.short_description = '총 좋아요 수'

    def created_at(self, obj):
        return obj.created_date.strftime('%Y-%m-%d %H:%M:%S')
    created_at.short_description = '작성일시'

    # Custom Actions
    def mark_as_heart(self, request, queryset):
        count = queryset.update(heart=True)
        self.message_user(request, f'{count}개의 댓글을 하트로 표시했습니다.')
    mark_as_heart.short_description = '선택한 댓글을 하트로 표시'

    def unmark_as_heart(self, request, queryset):
        count = queryset.update(heart=False)
        self.message_user(request, f'{count}개의 댓글의 하트를 해제했습니다.')
    unmark_as_heart.short_description = '선택한 댓글의 하트 해제'

    def delete_selected_comments(self, request, queryset):
        count = queryset.count()
        queryset.delete()
        self.message_user(request, f'{count}개의 댓글을 삭제했습니다.')
    delete_selected_comments.short_description = '선택한 댓글 삭제'

    def migrate_mentions_to_replies(self, request, queryset):
        """Migrate comments with backtick mentions to reply system"""
        from modules.markdown import parse_to_html
        from django.db import transaction

        # Filter comments that have mentions and no parent
        mention_pattern = r'`@([a-zA-Z0-9\.]+)`'

        if request.POST.get('confirm'):
            # Execute migration
            migration_count = 0
            error_count = 0
            errors = []

            for comment_id in request.POST.getlist('comment_ids'):
                try:
                    comment = Comment.objects.get(id=comment_id)
                    parent_id = request.POST.get(f'parent_{comment_id}')

                    if not parent_id:
                        continue

                    with transaction.atomic():
                        parent = Comment.objects.get(id=parent_id)

                        # Extract mentioned username
                        mentions = re.findall(mention_pattern, comment.text_md)
                        if mentions:
                            mentioned_username = mentions[0]

                            # Remove mention from text
                            new_text_md = re.sub(
                                r'`@' + re.escape(mentioned_username) + r'`\s*',
                                '',
                                comment.text_md,
                                count=1
                            ).strip()

                            if new_text_md:
                                comment.parent = parent
                                comment.text_md = new_text_md
                                comment.text_html = parse_to_html(new_text_md)
                                comment.save()
                                migration_count += 1

                except Exception as e:
                    error_count += 1
                    errors.append(f'Comment {comment_id}: {str(e)}')

            if migration_count > 0:
                self.message_user(request, f'✅ {migration_count}개의 댓글을 답글로 마이그레이션했습니다.', messages.SUCCESS)
            if error_count > 0:
                self.message_user(request, f'⚠️ {error_count}개의 댓글 마이그레이션 실패: {"; ".join(errors[:3])}', messages.WARNING)

            return HttpResponseRedirect(request.get_full_path())

        # Prepare migration preview data
        migration_data = []

        for comment in queryset.filter(parent__isnull=True):
            mentions = re.findall(mention_pattern, comment.text_md)
            if not mentions:
                continue

            mentioned_username = mentions[0]

            # Find potential parent
            potential_parents = Comment.objects.filter(
                post=comment.post,
                author__username=mentioned_username,
                created_date__lt=comment.created_date,
                parent__isnull=True
            ).select_related('author').order_by('-created_date')

            if potential_parents.exists():
                parent = potential_parents.first()

                # Generate new text preview
                new_text_md = re.sub(
                    r'`@' + re.escape(mentioned_username) + r'`\s*',
                    '',
                    comment.text_md,
                    count=1
                ).strip()

                if new_text_md:
                    migration_data.append({
                        'comment': comment,
                        'mentioned_username': mentioned_username,
                        'parent': parent,
                        'old_text': comment.text_md,
                        'new_text': new_text_md,
                        'new_html': parse_to_html(new_text_md),
                    })

        if not migration_data:
            self.message_user(request, '마이그레이션 가능한 댓글이 없습니다.', messages.WARNING)
            return HttpResponseRedirect(request.get_full_path())

        context = {
            'title': '멘션을 답글로 마이그레이션',
            'migration_data': migration_data,
            'queryset': queryset,
            'opts': self.model._meta,
            'action_checkbox_name': admin.helpers.ACTION_CHECKBOX_NAME,
        }

        return render(request, 'admin/board/comment/migrate_mentions.html', context)

    migrate_mentions_to_replies.short_description = '🔄 선택한 댓글의 멘션을 답글로 마이그레이션'

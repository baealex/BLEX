from django.contrib import admin
from django.utils.html import strip_tags, format_html
from django.utils.safestring import mark_safe
from django.template.defaultfilters import truncatewords
from django.db.models import Count

from board.models import Comment

from .service import AdminDisplayService, AdminLinkService
from .constants import COLOR_MUTED, COLOR_DARKENED_BG, COLOR_WARNING, COLOR_DANGER, COLOR_TEXT, COLOR_BG, COLOR_BORDER


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    autocomplete_fields = ['post']
    search_fields = ['text_md', 'author__username', 'post__title']

    list_filter = [
        'edited',
        'heart',
        ('created_date', admin.DateFieldListFilter),
    ]

    actions = ['mark_as_heart', 'unmark_as_heart', 'delete_selected_comments']

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

    list_display = ['id', 'content_preview', 'post_link', 'author_link', 'likes_display', 'status_badges', 'created_date']
    list_display_links = ['content_preview']
    list_per_page = 30
    save_on_top = True
    date_hierarchy = 'created_date'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author', 'post').prefetch_related('likes').annotate(
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

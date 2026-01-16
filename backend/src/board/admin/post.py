"""
Post Admin Configuration
"""
from typing import Any, Optional
from django.contrib import admin
from django.db.models import Count, QuerySet
from django.http import HttpRequest

from board.models import (
    EditHistory, EditRequest, Post, PinnedPost,
    PostConfig, PostContent, PostLikes, TempPosts,
)

from .service import AdminDisplayService, AdminLinkService
from .constants import (
    LIST_PER_PAGE_DEFAULT, LIST_PER_PAGE_LARGE,
    THUMBNAIL_SIZE, DATETIME_FORMAT_FULL
)


admin.site.register(EditHistory)
admin.site.register(EditRequest)
admin.site.register(PinnedPost)


class PostContentInline(admin.StackedInline):
    """Inline editor for post content (markdown and HTML)."""
    model = PostContent
    can_delete = False
    classes = ['collapse']
    fields = ['text_md', 'text_html']
    extra = 0
    max_num = 1


class PostConfigInline(admin.TabularInline):
    """Inline editor for post configuration (visibility, notices, etc)."""
    model = PostConfig
    can_delete = False
    fields = ['hide', 'notice', 'advertise', 'block_comment']
    extra = 0
    max_num = 1


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    """
    Post 관리 페이지

    - select_related/prefetch_related로 쿼리 최적화
    - 대량 작업 시 bulk operation 사용
    """

    search_fields = ['title', 'content__text_md', 'author__username', 'series__name', 'tags__value']
    ordering = ['-created_date']
    inlines = [PostContentInline, PostConfigInline]
    autocomplete_fields = ['author', 'series']

    list_filter = [
        ('created_date', admin.DateFieldListFilter),
        ('updated_date', admin.DateFieldListFilter),
        'config__hide',
        'config__notice',
        'config__advertise',
        'config__block_comment',
    ]

    list_display = [
        'thumbnail_preview',
        'title',
        'author_link',
        'series_link',
        'tags_preview',
        'likes_count',
        'comments_count',
        'status_badges',
        'created_date',
    ]
    list_display_links = ['title']
    list_per_page = LIST_PER_PAGE_DEFAULT
    actions = ['make_hidden', 'make_visible', 'make_notice', 'remove_notice']

    fieldsets = (
        ('기본 정보', {
            'fields': ('author', 'title', 'url', 'series')
        }),
        ('이미지', {
            'fields': ('image', 'image_preview'),
            'classes': ('collapse',)
        }),
        ('태그 & 메타', {
            'fields': ('tags', 'meta_description', 'read_time')
        }),
        ('통계', {
            'fields': ('total_likes', 'total_comments', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['url', 'image_preview', 'total_likes', 'total_comments', 'created_at', 'updated_at']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'author', 'content', 'config', 'series'
        ).prefetch_related('tags', 'likes', 'comments').annotate(
            likes_count=Count('likes', distinct=True),
            comments_count=Count('comments', distinct=True)
        )

    def thumbnail_preview(self, obj: Post) -> str:
        width, height = THUMBNAIL_SIZE
        return AdminDisplayService.image_preview(
            obj.image.url if obj.image else None,
            width=width,
            height=height
        )
    thumbnail_preview.short_description = ''

    def author_link(self, obj: Post) -> str:
        return AdminLinkService.create_user_link(obj.author)
    author_link.short_description = '작성자'

    def series_link(self, obj: Post) -> str:
        return AdminLinkService.create_series_link(obj.series)
    series_link.short_description = '시리즈'

    def tags_preview(self, obj: Post) -> str:
        return AdminDisplayService.tags_badges(obj.tags.all())
    tags_preview.short_description = '태그'

    def likes_count(self, obj: Post) -> str:
        count = obj.likes_count if hasattr(obj, 'likes_count') else obj.likes.count()
        return AdminDisplayService.like_count_badge(count)
    likes_count.short_description = '좋아요'
    likes_count.admin_order_field = 'likes_count'

    def comments_count(self, obj: Post) -> str:
        count = obj.comments_count if hasattr(obj, 'comments_count') else obj.comments.count()
        return AdminDisplayService.comment_count_badge(count)
    comments_count.short_description = '댓글'
    comments_count.admin_order_field = 'comments_count'

    def status_badges(self, obj: Post) -> str:
        if hasattr(obj, 'config'):
            return AdminDisplayService.post_status_badges(obj.config)
        return AdminDisplayService.empty_placeholder()
    status_badges.short_description = '상태'

    def image_preview(self, obj: Post) -> str:
        if obj.image:
            return AdminDisplayService.image_preview(obj.image.url, width='400px', height='auto')
        return '이미지 없음'
    image_preview.short_description = '이미지 미리보기'

    def total_likes(self, obj: Post) -> int:
        return obj.likes.count()
    total_likes.short_description = '총 좋아요 수'

    def total_comments(self, obj: Post) -> int:
        return obj.comments.count()
    total_comments.short_description = '총 댓글 수'

    def created_at(self, obj: Post) -> str:
        return AdminDisplayService.date_display(obj.created_date, DATETIME_FORMAT_FULL)
    created_at.short_description = '생성일시'

    def updated_at(self, obj: Post) -> str:
        return AdminDisplayService.date_display(obj.updated_date, DATETIME_FORMAT_FULL)
    updated_at.short_description = '수정일시'

    # Bulk operations for better performance
    def make_hidden(self, request: HttpRequest, queryset: QuerySet[Post]) -> None:
        """선택한 포스트 숨김 처리 (bulk update)"""
        post_ids = list(queryset.values_list('id', flat=True))
        count = PostConfig.objects.filter(post_id__in=post_ids).update(hide=True)
        self.message_user(request, f'{count}개의 포스트를 숨김 처리했습니다.')
    make_hidden.short_description = '선택한 포스트 숨김 처리'

    def make_visible(self, request: HttpRequest, queryset: QuerySet[Post]) -> None:
        """선택한 포스트 공개 처리 (bulk update)"""
        post_ids = list(queryset.values_list('id', flat=True))
        count = PostConfig.objects.filter(post_id__in=post_ids).update(hide=False)
        self.message_user(request, f'{count}개의 포스트를 공개 처리했습니다.')
    make_visible.short_description = '선택한 포스트 공개 처리'

    def make_notice(self, request: HttpRequest, queryset: QuerySet[Post]) -> None:
        """선택한 포스트 공지로 설정 (bulk update)"""
        post_ids = list(queryset.values_list('id', flat=True))
        count = PostConfig.objects.filter(post_id__in=post_ids).update(notice=True)
        self.message_user(request, f'{count}개의 포스트를 공지로 설정했습니다.')
    make_notice.short_description = '선택한 포스트 공지로 설정'

    def remove_notice(self, request: HttpRequest, queryset: QuerySet[Post]) -> None:
        """선택한 포스트 공지 해제 (bulk update)"""
        post_ids = list(queryset.values_list('id', flat=True))
        count = PostConfig.objects.filter(post_id__in=post_ids).update(notice=False)
        self.message_user(request, f'{count}개의 포스트를 일반 포스트로 변경했습니다.')
    remove_notice.short_description = '선택한 포스트 공지 해제'


@admin.register(PostConfig)
class PostConfigAdmin(admin.ModelAdmin):
    list_display = ['id']
    list_per_page = LIST_PER_PAGE_LARGE

    def get_form(self, request: HttpRequest, obj: Optional[PostConfig] = None, **kwargs: Any) -> Any:
        kwargs['exclude'] = ['post']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostContent)
class PostContentAdmin(admin.ModelAdmin):
    fieldsets = (
        (None, {
            'fields': ('text_md', 'text_html'),
        }),
        ('Preview', {
            'fields': ('text_html_preview',),
        }),
    )
    readonly_fields = ['text_html_preview']

    def text_html_preview(self, obj: PostContent) -> str:
        return AdminDisplayService.html(obj.text_html)
    text_html_preview.short_description = 'HTML 미리보기'

    list_display = ['id']
    list_per_page = LIST_PER_PAGE_LARGE


@admin.register(TempPosts)
class TempPostsAdmin(admin.ModelAdmin):
    list_display = ['author_link', 'title', 'created_date', 'updated_date']
    list_display_links = ['title']
    list_per_page = LIST_PER_PAGE_DEFAULT

    def get_queryset(self, request: HttpRequest) -> QuerySet[TempPosts]:
        return super().get_queryset(request).select_related('author')

    def author_link(self, obj: TempPosts) -> str:
        return AdminLinkService.create_user_link(obj.author)
    author_link.short_description = 'author'

    def get_form(self, request: HttpRequest, obj: Optional[TempPosts] = None, **kwargs: Any) -> Any:
        kwargs['exclude'] = ['author', 'token']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostLikes)
class PostLikesAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post', 'created_date']
    list_display_links = ['id']

    def get_form(self, request: HttpRequest, obj: Optional[PostLikes] = None, **kwargs: Any) -> Any:
        kwargs['exclude'] = ['user', 'post']
        return super().get_form(request, obj, **kwargs)

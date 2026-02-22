"""
Post Admin Configuration
"""
from django.contrib import admin
from django.db.models import Count, QuerySet
from django.http import HttpRequest
from django.utils import timezone

from board.models import (
    EditHistory, EditRequest, Post, PinnedPost,
    PostConfig, PostContent,
)

from .service import AdminDisplayService, AdminLinkService
from .constants import (
    LIST_PER_PAGE_DEFAULT,
    THUMBNAIL_SIZE, DATETIME_FORMAT_FULL
)


class PublishStatusFilter(admin.SimpleListFilter):
    """발행 상태 필터 (임시글/발행됨/예약됨)"""
    title = '발행 상태'
    parameter_name = 'publish_status'

    def lookups(self, request, model_admin):
        return [
            ('draft', '임시글'),
            ('published', '발행됨'),
            ('scheduled', '예약됨'),
        ]

    def queryset(self, request, queryset):
        now = timezone.now()
        if self.value() == 'draft':
            return queryset.filter(published_date__isnull=True)
        elif self.value() == 'published':
            return queryset.filter(published_date__isnull=False, published_date__lte=now)
        elif self.value() == 'scheduled':
            return queryset.filter(published_date__isnull=False, published_date__gt=now)


@admin.register(EditHistory)
class EditHistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'post', 'created_date']
    list_per_page = LIST_PER_PAGE_DEFAULT
    search_fields = ['post__title']
    readonly_fields = ['post', 'created_date']


@admin.register(EditRequest)
class EditRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'post', 'created_date']
    list_per_page = LIST_PER_PAGE_DEFAULT
    search_fields = ['post__title']


@admin.register(PinnedPost)
class PinnedPostAdmin(admin.ModelAdmin):
    list_display = ['id', 'post', 'user', 'order']
    list_per_page = LIST_PER_PAGE_DEFAULT
    search_fields = ['post__title', 'user__username']
    autocomplete_fields = ['post', 'user']


class PostContentInline(admin.StackedInline):
    """Inline editor for post content (markdown and HTML)."""
    model = PostContent
    can_delete = False
    classes = ['collapse']
    fields = ['text_md', 'text_html']
    extra = 0
    max_num = 1


class PostConfigInline(admin.TabularInline):
    """Inline editor for post configuration (visibility, etc)."""
    model = PostConfig
    can_delete = False
    fields = ['hide', 'advertise', 'block_comment']
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
        PublishStatusFilter,
        ('created_date', admin.DateFieldListFilter),
        ('updated_date', admin.DateFieldListFilter),
        'config__hide',
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
        'publish_status',
        'status_badges',
        'published_date_display',
        'created_date',
    ]
    list_display_links = ['title']
    list_per_page = LIST_PER_PAGE_DEFAULT
    save_on_top = True
    date_hierarchy = 'created_date'
    actions = ['make_hidden', 'make_visible', 'publish_drafts']

    fieldsets = (
        ('기본 정보', {
            'fields': ('author', 'title', 'url', 'series')
        }),
        ('발행', {
            'fields': ('published_date', 'publish_status_display'),
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

    readonly_fields = ['image_preview', 'publish_status_display', 'total_likes', 'total_comments', 'created_at', 'updated_at']

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

    def publish_status(self, obj: Post) -> str:
        return AdminDisplayService.publish_status_badge(obj)
    publish_status.short_description = '발행'
    publish_status.admin_order_field = 'published_date'

    def published_date_display(self, obj: Post) -> str:
        return AdminDisplayService.date_display(obj.published_date, DATETIME_FORMAT_FULL)
    published_date_display.short_description = '발행일'
    published_date_display.admin_order_field = 'published_date'

    def publish_status_display(self, obj: Post) -> str:
        return AdminDisplayService.publish_status_badge(obj)
    publish_status_display.short_description = '발행 상태'

    def status_badges(self, obj: Post) -> str:
        if hasattr(obj, 'config'):
            return AdminDisplayService.post_status_badges(obj.config)
        return AdminDisplayService.empty_placeholder()
    status_badges.short_description = '설정'

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

    def publish_drafts(self, request: HttpRequest, queryset: QuerySet[Post]) -> None:
        """선택한 임시글을 즉시 발행 (bulk update)"""
        count = queryset.filter(published_date__isnull=True).update(published_date=timezone.now())
        self.message_user(request, f'{count}개의 임시글을 발행했습니다.')
    publish_drafts.short_description = '선택한 임시글 즉시 발행'


from django.contrib import admin
from django.db.models import Count
from django.urls import reverse
from django.utils.html import format_html

from board.models import Series, Post
from board.services.public_post_service import PublicPostService

from .service import AdminDisplayService, AdminLinkService
from .constants import (
    COLOR_DANGER, COLOR_SUCCESS, COLOR_PRIMARY, COLOR_MUTED,
    COLOR_INFO, COLOR_DARKENED_BG, COLOR_TEXT, COLOR_BG, COLOR_BORDER
)


class SeriesPostInline(admin.TabularInline):
    model = Post
    fields = ['title', 'created_date', 'config_hide', 'view_link']
    readonly_fields = ['title', 'created_date', 'config_hide', 'view_link']
    can_delete = False
    extra = 0
    max_num = 0
    show_change_link = True

    def config_hide(self, obj):
        if hasattr(obj, 'config') and obj.config.hide:
            return format_html('<span style="color: {};">숨김</span>', COLOR_DANGER)
        return format_html('<span style="color: {};">공개</span>', COLOR_SUCCESS)
    config_hide.short_description = '상태'

    def view_link(self, obj):
        url = reverse('admin:board_post_change', args=[obj.id])
        return format_html('<a href="{}" style="color: {};">편집</a>', url, COLOR_PRIMARY)
    view_link.short_description = '편집'


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    inlines = [SeriesPostInline]
    autocomplete_fields = ['owner']
    search_fields = ['name', 'owner__username', 'text_md']

    # autocomplete 지원
    ordering = ['name']

    list_filter = [
        'hide',
        'layout',
        ('created_date', admin.DateFieldListFilter),
        ('updated_date', admin.DateFieldListFilter),
    ]

    actions = ['make_hidden', 'make_visible', 'set_layout_list', 'set_layout_card']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'owner'
        ).annotate(
            count_posts=Count('posts', distinct=True)
        )

    fieldsets = (
        ('기본 정보', {
            'fields': ('owner', 'name', 'url'),
        }),
        ('설정', {
            'fields': ('hide', 'layout', 'order'),
        }),
        ('내용', {
            'fields': ('text_md', 'text_html'),
            'classes': ('collapse',),
        }),
        ('포스트 목록', {
            'fields': ('posts_summary',),
        }),
        ('메타데이터', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ['url', 'posts_summary', 'created_at', 'updated_at']

    list_display = [
        'name',
        'owner_link',
        'count_posts',
        'layout_badge',
        'visibility_badge',
        'thumbnail_preview',
        'created_date'
    ]
    list_display_links = ['name']
    list_per_page = 30
    save_on_top = True

    def owner_link(self, obj):
        return AdminLinkService.create_user_link(obj.owner)
    owner_link.short_description = '작성자'

    def count_posts(self, obj):
        count = obj.count_posts if hasattr(obj, 'count_posts') else obj.posts.count()
        return format_html('📚 {}', count)
    count_posts.short_description = '포스트 수'
    count_posts.admin_order_field = 'count_posts'

    def layout_badge(self, obj):
        if obj.layout == 'card':
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; border-radius: 4px; font-size: 11px; opacity: 0.8;">카드</span>',
                COLOR_INFO, COLOR_BG
            )
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; border-radius: 4px; font-size: 11px; opacity: 0.8;">리스트</span>',
            COLOR_DARKENED_BG, COLOR_TEXT
        )
    layout_badge.short_description = '레이아웃'

    def visibility_badge(self, obj):
        if obj.hide:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; border-radius: 4px; font-size: 11px; opacity: 0.8;">숨김</span>',
                COLOR_DANGER, COLOR_BG
            )
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; border-radius: 4px; font-size: 11px; opacity: 0.8;">공개</span>',
            COLOR_SUCCESS, COLOR_BG
        )
    visibility_badge.short_description = '상태'

    def thumbnail_preview(self, obj):
        thumbnail_url = obj.thumbnail()
        if thumbnail_url:
            return format_html(
                '<img src="{}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;" />',
                thumbnail_url
            )
        return format_html(
            '<div style="width: 60px; height: 60px; background: {}; border-radius: 6px;"></div>',
            COLOR_DARKENED_BG
        )
    thumbnail_preview.short_description = ''

    def posts_summary(self, obj):
        posts = obj.posts.all()
        if not posts:
            return format_html('<p style="color: {};">포스트 없음</p>', COLOR_MUTED)

        total_posts = posts.count()
        public_posts = PublicPostService.filter_public_posts(posts).count()
        non_public_posts = total_posts - public_posts

        return format_html(
            '<div style="background: {}; padding: 12px; border-radius: 6px; border: 1px solid {};">'
            '<p style="margin: 4px 0; color: {};"><strong>총 포스트:</strong> {}</p>'
            '<p style="margin: 4px 0; color: {};"><strong>공개 노출:</strong> <span style="color: {};">{}</span></p>'
            '<p style="margin: 4px 0; color: {};"><strong>비공개 상태:</strong> <span style="color: {};">{}</span></p>'
            '</div>',
            COLOR_DARKENED_BG, COLOR_BORDER,
            COLOR_TEXT, total_posts,
            COLOR_TEXT, COLOR_SUCCESS, public_posts,
            COLOR_TEXT, COLOR_DANGER, non_public_posts
        )
    posts_summary.short_description = '포스트 요약'

    def created_at(self, obj):
        return obj.created_date.strftime('%Y-%m-%d %H:%M:%S')
    created_at.short_description = '생성일시'

    def updated_at(self, obj):
        return obj.updated_date.strftime('%Y-%m-%d %H:%M:%S')
    updated_at.short_description = '수정일시'

    # Custom Actions
    def make_hidden(self, request, queryset):
        count = queryset.update(hide=True)
        self.message_user(request, f'{count}개의 시리즈를 숨김 처리했습니다.')
    make_hidden.short_description = '선택한 시리즈 숨김 처리'

    def make_visible(self, request, queryset):
        count = queryset.update(hide=False)
        self.message_user(request, f'{count}개의 시리즈를 공개 처리했습니다.')
    make_visible.short_description = '선택한 시리즈 공개 처리'

    def set_layout_list(self, request, queryset):
        count = queryset.update(layout='list')
        self.message_user(request, f'{count}개의 시리즈를 리스트 레이아웃으로 변경했습니다.')
    set_layout_list.short_description = '레이아웃을 리스트로 변경'

    def set_layout_card(self, request, queryset):
        count = queryset.update(layout='card')
        self.message_user(request, f'{count}개의 시리즈를 카드 레이아웃으로 변경했습니다.')
    set_layout_card.short_description = '레이아웃을 카드로 변경'

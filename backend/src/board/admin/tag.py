from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html

from board.models import Tag
from .constants import (
    COLOR_INFO, COLOR_BG, COLOR_DANGER, COLOR_WARNING,
    COLOR_SUCCESS, COLOR_MUTED, COLOR_TEXT
)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    search_fields = ['value']
    actions = ['clear_unused_tags', 'merge_tags']

    list_display = ['tag_badge', 'count', 'has_image', 'usage_status']
    list_display_links = ['tag_badge']
    list_per_page = 50

    list_filter = [
        ('posts__published_date', admin.DateFieldListFilter),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            post_count=Count('posts', distinct=True)
        )

    def tag_badge(self, obj):
        return obj.value
    tag_badge.short_description = '태그'

    def count(self, obj):
        count = obj.post_count if hasattr(obj, 'post_count') else obj.posts.count()
        if count == 0:
            return format_html('<span style="color: {}; font-weight: 600;">0</span>', COLOR_DANGER)
        elif count < 5:
            return format_html('<span style="color: {};">{}</span>', COLOR_WARNING, count)
        else:
            return format_html('<span style="color: {}; font-weight: 600;">{}</span>', COLOR_SUCCESS, count)
    count.short_description = '사용 횟수'
    count.admin_order_field = 'post_count'

    def has_image(self, obj):
        if obj.get_image():
            return format_html('<span style="color: {};">✓ 있음</span>', COLOR_SUCCESS)
        return format_html('<span style="color: {};">✗ 없음</span>', COLOR_MUTED)
    has_image.short_description = '대표 이미지'

    def usage_status(self, obj):
        count = obj.post_count if hasattr(obj, 'post_count') else obj.posts.count()
        if count == 0:
            return format_html(
                '<span style="background: {}; color: {}; padding: 2px 8px; border-radius: 4px; font-size: 10px; opacity: 0.8;">미사용</span>',
                COLOR_DANGER, COLOR_BG
            )
        elif count < 3:
            return format_html(
                '<span style="background: {}; color: {}; padding: 2px 8px; border-radius: 4px; font-size: 10px; opacity: 0.8;">저빈도</span>',
                COLOR_WARNING, COLOR_BG
            )
        elif count < 10:
            return format_html(
                '<span style="background: {}; color: {}; padding: 2px 8px; border-radius: 4px; font-size: 10px; opacity: 0.8;">중빈도</span>',
                COLOR_INFO, COLOR_BG
            )
        else:
            return format_html(
                '<span style="background: {}; color: {}; padding: 2px 8px; border-radius: 4px; font-size: 10px; opacity: 0.8;">고빈도</span>',
                COLOR_SUCCESS, COLOR_BG
            )
    usage_status.short_description = '사용 상태'

    # Custom Actions
    def clear_unused_tags(self, request, queryset):
        count = 0
        total = 0
        for tag in queryset:
            total += 1
            tag_count = tag.post_count if hasattr(tag, 'post_count') else tag.posts.count()
            if tag_count == 0:
                count += 1
                tag.delete()
        self.message_user(request, f'{total}개의 태그 중 참조가 없는 {count}개의 태그를 삭제했습니다.')
    clear_unused_tags.short_description = '선택한 태그 중 미사용 태그 삭제'

from typing import Any

from django.contrib import admin, messages
from django.db import transaction
from django.db.models import Count, QuerySet
from django.http import HttpRequest
from django.utils.html import format_html

from board.models import Tag

from .action_confirmation import render_action_confirmation
from .constants import (
    COLOR_INFO, COLOR_BG, COLOR_DANGER, COLOR_WARNING,
    COLOR_SUCCESS, COLOR_MUTED, COLOR_TEXT
)
from .mixins import ConfirmedActionDeleteAdminMixin
from .utilities import TagCleanerService


@admin.register(Tag)
class TagAdmin(ConfirmedActionDeleteAdminMixin, admin.ModelAdmin):
    search_fields = ['value']
    actions = ['clear_unused_tags']

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

    @admin.action(
        description='선택한 태그 중 미사용 태그 삭제',
        permissions=['delete'],
    )
    def clear_unused_tags(
        self,
        request: HttpRequest,
        queryset: QuerySet[Tag],
    ) -> Any:
        unused_tags = TagCleanerService.filter_unused(queryset)
        if request.POST.get('confirm') != 'yes':
            if not unused_tags.exists():
                self.message_user(
                    request,
                    '선택한 항목에 미사용 태그가 없습니다.',
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                unused_tags,
                action_name='clear_unused_tags',
                title='미사용 태그 삭제 확인',
                warning=(
                    '현재 어떤 포스트에서도 참조하지 않는 태그만 삭제합니다. '
                    '삭제한 태그는 복구할 수 없습니다.'
                ),
                confirm_label='미사용 태그 삭제',
            )

        selected_ids = list(queryset.values_list('pk', flat=True))
        with transaction.atomic():
            unused_ids = list(
                TagCleanerService.filter_unused(
                    Tag.objects.filter(pk__in=selected_ids),
                ).values_list('pk', flat=True),
            )
            locked_tags = list(
                Tag.objects.select_for_update().filter(pk__in=unused_ids),
            )
            locked_ids = [tag.pk for tag in locked_tags]
            confirmed_unused_ids = set(
                TagCleanerService.filter_unused(
                    Tag.objects.filter(pk__in=locked_ids),
                ).values_list('pk', flat=True),
            )
            deletable_tags = [
                tag for tag in locked_tags
                if tag.pk in confirmed_unused_ids
            ]
            self.log_deletions(request, deletable_tags)
            count, _ = TagCleanerService.clean_selected_unused_tags(
                Tag.objects.filter(
                    pk__in=[tag.pk for tag in deletable_tags],
                ),
                execute=True,
            )

        self.message_user(
            request,
            f'{count}개의 미사용 태그를 삭제했습니다.',
            level=messages.SUCCESS,
        )
        return None

"""
태그 정리 서비스 - 미사용 태그 찾기 및 삭제
"""
from typing import Any, Dict, List, Tuple

from django.db.models import Count, QuerySet

from board.models import Tag


class TagCleanerService:
    """태그 정리 서비스"""

    @staticmethod
    def filter_unused(tags: QuerySet[Tag]) -> QuerySet[Tag]:
        return tags.annotate(
            cleanup_post_count=Count('posts', distinct=True),
        ).filter(cleanup_post_count=0)

    @staticmethod
    def get_unused_tags() -> List[Dict[str, Any]]:
        """미사용 태그 목록 조회"""
        # 포스트가 없는 태그 찾기
        tags = TagCleanerService.filter_unused(
            Tag.objects.all(),
        ).order_by('value')

        unused_tags = []
        for tag in tags:
            unused_tags.append({
                'id': tag.pk,
                'name': tag.value,
                'created': tag.created_date if hasattr(tag, 'created_date') else None,
            })

        return unused_tags

    @staticmethod
    def get_tag_statistics() -> Dict[str, Any]:
        """태그 통계"""
        total_tags = Tag.objects.count()
        tags_with_posts = Tag.objects.annotate(
            post_count=Count('posts')
        ).filter(post_count__gt=0).count()

        unused_count = total_tags - tags_with_posts

        # 가장 많이 사용된 태그 Top 10
        top_tags = Tag.objects.annotate(
            post_count=Count('posts')
        ).filter(post_count__gt=0).order_by('-post_count')[:10]

        top_tags_list = []
        for tag in top_tags:
            top_tags_list.append({
                'name': tag.value,
                'count': tag.post_count
            })

        return {
            'total_tags': total_tags,
            'used_tags': tags_with_posts,
            'unused_tags': unused_count,
            'top_tags': top_tags_list,
        }

    @staticmethod
    def clean_unused_tags(execute: bool = False) -> Tuple[int, List[str]]:
        """미사용 태그 삭제"""
        return TagCleanerService.clean_selected_unused_tags(
            Tag.objects.all(),
            execute=execute,
        )

    @staticmethod
    def clean_selected_unused_tags(
        tags: QuerySet[Tag],
        *,
        execute: bool = False,
    ) -> Tuple[int, List[str]]:
        unused_tags = TagCleanerService.filter_unused(tags)

        tag_names = list(unused_tags.values_list('value', flat=True))
        count = len(tag_names)

        if execute:
            unused_tags.delete()

        return count, tag_names

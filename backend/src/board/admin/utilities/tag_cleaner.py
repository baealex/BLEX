"""
태그 정리 서비스 - 미사용 태그 찾기 및 삭제
"""
from typing import List, Dict, Any, Tuple
from django.db.models import Count

from board.models import Post, Tag


class TagCleanerService:
    """태그 정리 서비스"""

    @staticmethod
    def get_unused_tags() -> List[Dict[str, Any]]:
        """미사용 태그 목록 조회"""
        # 포스트가 없는 태그 찾기
        tags = Tag.objects.annotate(
            post_count=Count('posts')
        ).filter(post_count=0).order_by('value')

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
        tags = Tag.objects.annotate(
            post_count=Count('posts')
        ).filter(post_count=0)

        tag_names = [tag.value for tag in tags]
        count = tags.count()

        if execute:
            tags.delete()

        return count, tag_names

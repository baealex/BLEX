"""
데이터베이스 통계 및 최적화 서비스
"""
from typing import Dict, Any
from django.db import connection
from django.contrib.sessions.models import Session
from django.utils import timezone

from board.models import Post, Comment, Profile, Series, ImageCache


class DatabaseStatsService:
    """데이터베이스 통계 서비스"""

    @staticmethod
    def get_statistics() -> Dict[str, Any]:
        """전체 데이터베이스 통계 수집"""
        stats = {}

        # 포스트 통계
        stats['total_posts'] = Post.objects.count()
        stats['published_posts'] = Post.objects.filter(config__hide=False).count()
        stats['hidden_posts'] = Post.objects.filter(config__hide=True).count()
        stats['draft_posts'] = Post.objects.filter(published_date__isnull=True).count()

        # 댓글 통계
        stats['total_comments'] = Comment.objects.count()

        # 사용자 통계
        from django.contrib.auth.models import User
        stats['total_users'] = User.objects.count()
        stats['active_profiles'] = Profile.objects.count()

        # 시리즈 통계
        stats['total_series'] = Series.objects.count()

        # 이미지 통계
        stats['image_cache_count'] = ImageCache.objects.count()

        # 세션 통계
        stats['total_sessions'] = Session.objects.count()
        stats['expired_sessions'] = Session.objects.filter(expire_date__lt=timezone.now()).count()

        # 데이터베이스 크기 (PostgreSQL/SQLite)
        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT pg_size_pretty(pg_database_size(current_database()))
                """)
                stats['db_size'] = cursor.fetchone()[0]
        elif connection.vendor == 'sqlite':
            import os
            db_path = connection.settings_dict['NAME']
            if os.path.exists(db_path):
                size_bytes = os.path.getsize(db_path)
                stats['db_size'] = f"{round(size_bytes / (1024 * 1024), 2)} MB"
        else:
            stats['db_size'] = 'N/A'

        return stats


class SessionCleanerService:
    """세션 정리 서비스"""

    @staticmethod
    def count_expired_sessions() -> int:
        """만료된 세션 개수 반환"""
        return Session.objects.filter(expire_date__lt=timezone.now()).count()

    @staticmethod
    def clean_expired_sessions() -> int:
        """만료된 세션 삭제"""
        expired = Session.objects.filter(expire_date__lt=timezone.now())
        count = expired.count()
        expired.delete()
        return count

    @staticmethod
    def clean_all_sessions() -> int:
        """모든 세션 삭제 (주의: 모든 사용자 로그아웃)"""
        count = Session.objects.count()
        Session.objects.all().delete()
        return count

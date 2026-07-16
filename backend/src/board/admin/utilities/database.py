"""
데이터베이스 통계 및 최적화 서비스
"""
from typing import Dict, Any
from django.contrib.auth.models import User
from django.db import connection
from django.contrib.sessions.models import Session
from django.utils import timezone

from board.models import Post, Comment, Profile, Series, ImageCache


class DatabaseStatsService:
    """데이터베이스 통계 서비스"""

    @staticmethod
    def get_statistics() -> Dict[str, Any]:
        """전체 데이터베이스 통계 수집"""
        quote = connection.ops.quote_name
        tables = {
            'post': quote(Post._meta.db_table),
            'config': quote(Post._meta.get_field('config').related_model._meta.db_table),
            'comment': quote(Comment._meta.db_table),
            'user': quote(User._meta.db_table),
            'profile': quote(Profile._meta.db_table),
            'series': quote(Series._meta.db_table),
            'image': quote(ImageCache._meta.db_table),
            'session': quote(Session._meta.db_table),
        }
        now = timezone.now()
        # 독립된 모델별 COUNT도 scalar subquery로 묶어 왕복을 한 번으로
        # 제한한다. 포스트 상태 여섯 종류와 세션 상태 둘은 각 테이블을
        # 한 번만 스캔하는 조건부 집계다.
        sql = f'''
            SELECT
                post_stats.total_posts,
                post_stats.public_posts,
                post_stats.published_posts,
                post_stats.scheduled_posts,
                post_stats.hidden_posts,
                post_stats.draft_posts,
                (SELECT COUNT(*) FROM {tables['comment']}) AS total_comments,
                (SELECT COUNT(*) FROM {tables['user']}) AS total_users,
                (SELECT COUNT(*) FROM {tables['profile']}) AS active_profiles,
                (SELECT COUNT(*) FROM {tables['series']}) AS total_series,
                (SELECT COUNT(*) FROM {tables['image']}) AS image_cache_count,
                session_stats.total_sessions,
                session_stats.expired_sessions
            FROM (
                SELECT
                    COUNT(*) AS total_posts,
                    COALESCE(SUM(CASE WHEN p.deleted_date IS NULL
                        AND p.published_date IS NOT NULL AND p.published_date <= %s
                        AND c.hide = FALSE THEN 1 ELSE 0 END), 0) AS public_posts,
                    COALESCE(SUM(CASE WHEN p.deleted_date IS NULL
                        AND p.published_date IS NOT NULL AND p.published_date <= %s
                        THEN 1 ELSE 0 END), 0) AS published_posts,
                    COALESCE(SUM(CASE WHEN p.deleted_date IS NULL
                        AND p.published_date IS NOT NULL AND p.published_date > %s
                        THEN 1 ELSE 0 END), 0) AS scheduled_posts,
                    COALESCE(SUM(CASE WHEN c.hide = TRUE THEN 1 ELSE 0 END), 0) AS hidden_posts,
                    COALESCE(SUM(CASE WHEN p.deleted_date IS NULL
                        AND p.published_date IS NULL THEN 1 ELSE 0 END), 0) AS draft_posts
                FROM {tables['post']} p
                LEFT JOIN {tables['config']} c ON c.post_id = p.id
            ) post_stats
            CROSS JOIN (
                SELECT
                    COUNT(*) AS total_sessions,
                    COALESCE(SUM(CASE WHEN expire_date < %s THEN 1 ELSE 0 END), 0)
                        AS expired_sessions
                FROM {tables['session']}
            ) session_stats
        '''
        columns = (
            'total_posts', 'public_posts', 'published_posts', 'scheduled_posts',
            'hidden_posts', 'draft_posts', 'total_comments', 'total_users',
            'active_profiles', 'total_series', 'image_cache_count',
            'total_sessions', 'expired_sessions',
        )
        with connection.cursor() as cursor:
            cursor.execute(sql, [now, now, now, now])
            stats = dict(zip(columns, cursor.fetchone(), strict=True))

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

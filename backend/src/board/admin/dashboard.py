from django.contrib import admin
from django.db.models import Count, Q
from django.utils.html import format_html
from django.urls import reverse
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

from board.models import Post, Comment, Series, Tag, Notify, Profile


class BLEXAdminSite(admin.AdminSite):
    site_header = 'BLEX 관리자'
    site_title = 'BLEX Admin'
    index_title = '대시보드'

    def index(self, request, extra_context=None):
        """
        Apple 스타일의 모던한 대시보드
        """
        extra_context = extra_context or {}

        # 통계 데이터 수집
        now = timezone.now()
        today = now.date()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        # 사용자 통계
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        editors = Profile.objects.filter(role=Profile.Role.EDITOR).count()
        new_users_week = User.objects.filter(date_joined__gte=week_ago).count()

        # 포스트 통계
        total_posts = Post.objects.count()
        visible_posts = Post.objects.filter(config__hide=False).count()
        hidden_posts = Post.objects.filter(config__hide=True).count()
        new_posts_week = Post.objects.filter(created_date__gte=week_ago).count()
        new_posts_month = Post.objects.filter(created_date__gte=month_ago).count()

        # 댓글 통계
        total_comments = Comment.objects.count()
        new_comments_week = Comment.objects.filter(created_date__gte=week_ago).count()

        # 시리즈 통계
        total_series = Series.objects.count()
        visible_series = Series.objects.filter(hide=False).count()

        # 태그 통계
        total_tags = Tag.objects.count()
        unused_tags = Tag.objects.annotate(post_count=Count('posts')).filter(post_count=0).count()

        # 알림 통계
        unread_notifies = Notify.objects.filter(has_read=False).count()

        # 최근 포스트 (상위 5개)
        recent_posts = Post.objects.select_related('author', 'config').order_by('-created_date')[:5]

        # 인기 포스트 (좋아요 상위 5개, 최근 30일)
        popular_posts = Post.objects.filter(
            created_date__gte=month_ago
        ).annotate(
            likes_count=Count('likes')
        ).order_by('-likes_count')[:5]

        # 최근 댓글 (상위 5개)
        recent_comments = Comment.objects.select_related('author', 'post').order_by('-created_date')[:5]

        extra_context['dashboard_stats'] = {
            'users': {
                'total': total_users,
                'active': active_users,
                'editors': editors,
                'new_week': new_users_week,
            },
            'posts': {
                'total': total_posts,
                'visible': visible_posts,
                'hidden': hidden_posts,
                'new_week': new_posts_week,
                'new_month': new_posts_month,
            },
            'comments': {
                'total': total_comments,
                'new_week': new_comments_week,
            },
            'series': {
                'total': total_series,
                'visible': visible_series,
            },
            'tags': {
                'total': total_tags,
                'unused': unused_tags,
            },
            'notifies': {
                'unread': unread_notifies,
            },
        }

        extra_context['recent_posts'] = recent_posts
        extra_context['popular_posts'] = popular_posts
        extra_context['recent_comments'] = recent_comments

        return super().index(request, extra_context)


# 커스텀 어드민 사이트 인스턴스
blex_admin_site = BLEXAdminSite(name='blex_admin')

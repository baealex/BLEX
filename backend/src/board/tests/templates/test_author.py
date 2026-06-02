"""
작가 페이지 템플릿 테스트
URL: @<username>, @<username>/series, @<username>/about
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import (
    Comment, Post, PostContent, PostConfig, PostLikes, Series, Profile, Tag, PinnedPost, SiteContentScope, SiteNotice
)


class AuthorPostsPageTestCase(TestCase):
    """작가 포스트 페이지 (@<username>) 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testauthor',
            email='author@example.com',
            password='testpass123'
        )
        # Create profile with EDITOR role
        Profile.objects.create(
            user=self.user,
            role=Profile.Role.EDITOR
        )

        # 포스트 생성
        self.post = Post.objects.create(
            title='Author Test Post',
            url='author-test-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now()
        )
        PostContent.objects.create(
            post=self.post,
            content_html='<h1>Author Content</h1>'
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False,

            advertise=False
        )

        # 태그 추가
        self.tag = Tag.objects.create(value='python')
        self.post.tags.add(self.tag)


    def create_author_post(self, title, url, published_date, tag=None, hide=False):
        post = Post.objects.create(
            title=title,
            url=url,
            author=self.user,
            created_date=timezone.now(),
            published_date=published_date,
        )
        PostContent.objects.create(
            post=post,
            content_html=f'<h1>{title}</h1>',
        )
        PostConfig.objects.create(
            post=post,
            hide=hide,
            advertise=False,
        )
        if tag:
            post.tags.add(tag)
        return post

    def test_author_posts_page_renders(self):
        """작가 포스트 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author_posts.html')
        self.assertContains(response, '포스트 검색')
        self.assertContains(response, '태그')
        self.assertContains(response, 'masonry-grid')
        self.assertNotContains(response, '정렬')
        self.assertContains(response, 'lg:w-44')
        self.assertContains(response, 'relative w-full')
        self.assertContains(response, 'flex w-full items-center justify-between')
        self.assertNotContains(response, 'sm:w-48')

    def test_author_overview_page_renders(self):
        """작가 개요 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author_overview.html')

    def test_author_overview_renders_user_notice_label(self):
        """작가 공지는 전체 공지가 아니라 블로그 공지로 표시한다."""
        SiteNotice.objects.create(
            scope=SiteContentScope.USER,
            user=self.user,
            title='Author Notice',
            url='/notice',
            is_active=True,
        )

        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Notice')
        self.assertContains(response, '공지')
        self.assertContains(response, 'Author Notice')
        self.assertNotContains(response, '전체 공지')
        self.assertNotContains(response, 'notice_carousel({')
        self.assertNotContains(response, 'fa-bullhorn')

    def test_author_overview_featured_posts_have_card_grid_and_posts_link(self):
        """대표 포스트 영역은 좁은 2열 카드 그리드와 전체 포스트 링크를 제공한다."""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'sm:grid-cols-2')
        self.assertNotContains(response, 'lg:grid-cols-3')
        self.assertContains(response, f'/@{self.user.username}/posts')
        self.assertNotContains(response, '먼저 읽어볼 글')

    def test_author_overview_featured_posts_limit_keeps_balanced_grid(self):
        """2열 카드 그리드가 세 줄로 맞도록 최대 6개까지 노출한다."""
        for index in range(6):
            self.create_author_post(
                f'Balanced Grid Post {index}',
                f'balanced-grid-post-{index}',
                timezone.now() - timezone.timedelta(minutes=index),
            )

        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context['featured_posts_section']['posts']), 6)

    def test_author_overview_empty_posts_prompt_is_owner_only(self):
        """공개 포스트가 없을 때 작성자 본인에게만 작성 안내를 보여준다."""
        empty_author = User.objects.create_user(
            username='emptyauthor',
            email='empty@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=empty_author, role=Profile.Role.EDITOR)

        visitor_response = self.client.get(
            reverse('user_profile', kwargs={'username': empty_author.username})
        )
        self.assertEqual(visitor_response.status_code, 200)
        self.assertNotContains(visitor_response, '아직 공개된 포스트가 없습니다.')

        self.client.login(username='emptyauthor', password='testpass123')
        owner_response = self.client.get(
            reverse('user_profile', kwargs={'username': empty_author.username})
        )
        self.assertEqual(owner_response.status_code, 200)
        self.assertContains(owner_response, '아직 공개된 포스트가 없습니다.')
        self.assertContains(owner_response, '포스트 작성하기')

    def test_author_overview_hides_empty_intro_from_visitors(self):
        """소개글이 없으면 방문자에게 소개 섹션을 노출하지 않는다."""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'About')
        self.assertNotContains(response, '소개글을 작성하면 프로필에 표시됩니다.')
        self.assertNotContains(response, '소개글 작성')
        self.assertNotContains(response, reverse('user_about_edit', kwargs={'username': self.user.username}))
        self.assertNotContains(response, '아직 소개글이 없습니다')

    def test_author_overview_shows_empty_intro_prompt_to_owner(self):
        """소개글이 없으면 작성자 본인에게 작성 진입점을 보여준다."""
        self.client.login(username='testauthor', password='testpass123')
        edit_path = reverse('user_about_edit', kwargs={'username': self.user.username})

        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'About')
        self.assertContains(response, '소개')
        self.assertContains(response, '소개글을 작성하면 프로필에 표시됩니다.')
        self.assertContains(response, '소개글 작성')
        self.assertNotContains(response, f'href="{edit_path}"')
        self.assertNotContains(response, '아직 소개글이 없습니다')

    def test_author_overview_renders_intro_content_with_owner_edit_entrypoint(self):
        """작성된 소개글은 방문자에게 보이고, 수정 진입점은 작성자 본인에게만 보인다."""
        edit_path = reverse('user_about_edit', kwargs={'username': self.user.username})
        self.user.profile.about_html = '<p>Visible author intro</p>'
        self.user.profile.save(update_fields=['about_html'])

        visitor_response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(visitor_response.status_code, 200)
        self.assertContains(visitor_response, 'About')
        self.assertContains(visitor_response, '소개')
        self.assertContains(visitor_response, 'Visible author intro')
        self.assertNotContains(visitor_response, '소개글 작성')
        self.assertNotContains(visitor_response, '소개글 수정')
        self.assertNotContains(visitor_response, edit_path)

        self.client.login(username='testauthor', password='testpass123')
        owner_response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(owner_response.status_code, 200)
        self.assertContains(owner_response, 'Visible author intro')
        self.assertContains(owner_response, '소개글 수정')
        self.assertNotContains(owner_response, f'href="{edit_path}"')
        self.assertContains(owner_response, 'x-show=hasRenderedContent')

    def test_author_overview_inline_intro_editor_updates_without_reload(self):
        """소개글 인라인 편집은 저장 후 페이지 새로고침 없이 렌더 HTML을 갱신한다."""
        self.client.login(username='testauthor', password='testpass123')

        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'x-html=renderedContent')
        self.assertContains(response, 'data.about_html')
        self.assertNotContains(response, 'window.location.reload()')

    def test_author_overview_omits_sidebar_stats_and_quick_links(self):
        """작성자 개요에서는 중복되는 통계와 바로가기 사이드바를 노출하지 않는다."""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, '<h3 class="text-lg font-bold text-content mb-6">통계</h3>', html=True)
        self.assertNotContains(response, '<h3 class="text-sm font-bold text-content mb-4">바로 가기</h3>', html=True)

    def test_author_overview_profile_image_edit_entrypoint_is_owner_only(self):
        """프로필 이미지 편집 진입점은 작성자 본인에게만 노출한다."""
        visitor_response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )
        self.assertEqual(visitor_response.status_code, 200)
        self.assertNotContains(visitor_response, '/settings/profile')

        self.client.login(username='testauthor', password='testpass123')
        owner_response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )
        self.assertEqual(owner_response.status_code, 200)
        self.assertContains(owner_response, '/settings/profile')

    def test_author_overview_cover_uses_cropped_card_ratio(self):
        """프로필 커버는 크롭 결과와 같은 3:1 카드 비율로 노출한다."""
        profile = Profile.objects.get(user=self.user)
        profile.cover = 'images/avatar/test/cover.png'
        profile.save(update_fields=['cover'])

        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'mx-auto max-w-4xl px-4 pt-6 sm:px-6 sm:pt-8')
        self.assertContains(response, 'relative aspect-[3/1] w-full overflow-hidden rounded-2xl ring-1 ring-line/60')
        self.assertContains(response, f'alt="{self.user.username} cover"')
        self.assertNotContains(response, 'h-44 w-full overflow-hidden sm:h-56 md:h-64')

    def test_author_overview_pinned_posts_setting_entrypoint_is_owner_only(self):
        """고정 포스트 설정 진입점은 작성자 본인에게만 노출한다."""
        visitor_response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )
        self.assertEqual(visitor_response.status_code, 200)
        self.assertNotContains(visitor_response, 'PinnedPostQuickAction')
        self.assertNotContains(visitor_response, '/settings/posts?section=pinned')

        self.client.login(username='testauthor', password='testpass123')
        owner_response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )
        self.assertEqual(owner_response.status_code, 200)
        self.assertContains(owner_response, 'PinnedPostQuickAction')
        self.assertNotContains(owner_response, '/settings/posts?section=pinned')

    def test_author_overview_social_link_add_entrypoint_uses_existing_empty_state(self):
        """소셜 링크가 없을 때는 기존 빈 상태 추가 링크만 노출한다."""
        self.client.login(username='testauthor', password='testpass123')

        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '소셜 링크 추가')
        self.assertContains(response, '/settings/social-links')
        self.assertNotContains(response, '소셜 링크 편집')

    def test_author_overview_recommended_posts_fallback_to_recent_posts(self):
        """고정 글이 없으면 추천 포스트는 좋아요 수가 아니라 최신 발행순으로 노출한다."""
        older_popular_post = self.create_author_post(
            'Older Popular Post',
            'older-popular-post',
            timezone.now() - timezone.timedelta(days=2),
        )
        newer_post = self.create_author_post(
            'Newer Post',
            'newer-post',
            timezone.now() - timezone.timedelta(days=1),
        )
        for index in range(3):
            liker = User.objects.create_user(username=f'liker{index}')
            PostLikes.objects.create(user=liker, post=older_popular_post)

        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['featured_posts_section']['title'], '최근 포스트')
        recommended_urls = [post['url'] for post in response.context['pinned_posts']]
        self.assertLess(
            recommended_urls.index('newer-post'),
            recommended_urls.index('older-popular-post'),
        )

    def test_author_overview_recommended_posts_use_pinned_order_first(self):
        """고정 글이 있으면 최신순 fallback 대신 고정 순서를 우선한다."""
        older_pinned_post = self.create_author_post(
            'Older Pinned Post',
            'older-pinned-post',
            timezone.now() - timezone.timedelta(days=5),
        )
        newer_pinned_post = self.create_author_post(
            'Newer Pinned Post',
            'newer-pinned-post',
            timezone.now(),
        )
        self.create_author_post(
            'Newest Unpinned Post',
            'newest-unpinned-post',
            timezone.now() + timezone.timedelta(days=1),
        )
        PinnedPost.objects.create(user=self.user, post=newer_pinned_post, order=2)
        PinnedPost.objects.create(user=self.user, post=older_pinned_post, order=1)

        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['featured_posts_section']['title'], '추천 포스트')
        recommended_urls = [post['url'] for post in response.context['pinned_posts']]
        self.assertEqual(recommended_urls, ['older-pinned-post', 'newer-pinned-post'])

    def test_author_overview_recent_activities_are_public_only(self):
        """작가 개요 최근 활동은 공개 가능한 글/시리즈 대상만 노출한다."""
        public_series = Series.objects.create(
            owner=self.user,
            name='Public Activity Series',
            url='public-activity-series',
            hide=False,
        )
        public_series_post = self.create_author_post(
            'Public Series Activity Post',
            'public-series-activity-post',
            timezone.now(),
        )
        public_series_post.series = public_series
        public_series_post.save(update_fields=['series'])

        hidden_post = self.create_author_post(
            'Hidden Activity Post',
            'hidden-activity-post',
            timezone.now(),
            hide=True,
        )
        draft_post = self.create_author_post(
            'Draft Activity Post',
            'draft-activity-post',
            None,
        )
        future_post = self.create_author_post(
            'Future Activity Post',
            'future-activity-post',
            timezone.now() + timezone.timedelta(days=1),
        )

        hidden_series = Series.objects.create(
            owner=self.user,
            name='Hidden Activity Series',
            url='hidden-activity-series',
            hide=True,
        )
        hidden_series_post = self.create_author_post(
            'Hidden Series Public Post',
            'hidden-series-public-post',
            timezone.now(),
        )
        hidden_series_post.series = hidden_series
        hidden_series_post.save(update_fields=['series'])
        Series.objects.create(
            owner=self.user,
            name='Empty Activity Series',
            url='empty-activity-series',
            hide=False,
        )
        draft_series = Series.objects.create(
            owner=self.user,
            name='Draft Only Activity Series',
            url='draft-only-activity-series',
            hide=False,
        )
        draft_post.series = draft_series
        draft_post.save(update_fields=['series'])
        future_series = Series.objects.create(
            owner=self.user,
            name='Future Only Activity Series',
            url='future-only-activity-series',
            hide=False,
        )
        future_post.series = future_series
        future_post.save(update_fields=['series'])
        hidden_post_series = Series.objects.create(
            owner=self.user,
            name='Hidden Post Only Activity Series',
            url='hidden-post-only-activity-series',
            hide=False,
        )
        hidden_post.series = hidden_post_series
        hidden_post.save(update_fields=['series'])

        Comment.objects.create(
            author=self.user,
            post=self.post,
            text_md='Public comment',
            text_html='<p>Public comment</p>',
        )
        Comment.objects.create(
            author=self.user,
            post=hidden_post,
            text_md='Hidden post comment',
            text_html='<p>Hidden post comment</p>',
        )
        PostLikes.objects.create(user=self.user, post=self.post)
        PostLikes.objects.create(user=self.user, post=hidden_post)

        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        activities = response.context['recent_activities']
        activity_titles = {
            activity.get('title') or activity.get('postTitle')
            for activity in activities
        }

        self.assertIn('Author Test Post', activity_titles)
        self.assertIn('Public Activity Series', activity_titles)
        self.assertNotIn('Hidden Activity Post', activity_titles)
        self.assertNotIn('Draft Activity Post', activity_titles)
        self.assertNotIn('Future Activity Post', activity_titles)
        self.assertNotIn('Hidden Activity Series', activity_titles)
        self.assertNotIn('Empty Activity Series', activity_titles)
        self.assertNotIn('Draft Only Activity Series', activity_titles)
        self.assertNotIn('Future Only Activity Series', activity_titles)
        self.assertNotIn('Hidden Post Only Activity Series', activity_titles)

        self.assertTrue(
            any(
                activity['type'] == 'comment'
                and activity['postTitle'] == 'Author Test Post'
                for activity in activities
            )
        )
        self.assertTrue(
            any(
                activity['type'] == 'like'
                and activity['postTitle'] == 'Author Test Post'
                for activity in activities
            )
        )
        self.assertFalse(
            any(
                activity['type'] in ['comment', 'like']
                and activity.get('postTitle') == 'Hidden Activity Post'
                for activity in activities
            )
        )

    def test_author_posts_page_exposes_public_posts_and_tags_only(self):
        """작가 글 표면은 숨김, 임시저장, 미래 발행 글과 그 태그를 노출하지 않는다."""
        private_tag = Tag.objects.create(value='private-only')
        self.create_author_post('Draft Author Post', 'draft-author-post', None, private_tag)
        self.create_author_post(
            'Future Author Post',
            'future-author-post',
            timezone.now() + timezone.timedelta(days=1),
            private_tag,
        )
        self.create_author_post('Hidden Author Post', 'hidden-author-post', timezone.now(), private_tag, hide=True)
        future_series = Series.objects.create(
            owner=self.user,
            name='Future Only Series',
            url='future-only-series',
            text_md='Future only',
            hide=False,
        )
        future_post = self.create_author_post(
            'Future Series Post',
            'future-series-post',
            timezone.now() + timezone.timedelta(days=1),
        )
        future_post.series = future_series
        future_post.save(update_fields=['series'])

        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        post_titles = [post.title for post in response.context['posts']]
        self.assertIn('Author Test Post', post_titles)
        self.assertNotIn('Draft Author Post', post_titles)
        self.assertNotIn('Future Author Post', post_titles)
        self.assertNotIn('Hidden Author Post', post_titles)

        author_tag_values = [tag.value for tag in response.context['author_tags']]
        self.assertIn('python', author_tag_values)
        self.assertNotIn('private-only', author_tag_values)
        self.assertEqual(response.context['series_count'], 0)

    def test_author_posts_page_has_required_context(self):
        """작가 포스트 페이지 컨텍스트에 필수 필드 확인"""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username})
        )

        required_fields = [
            'author', 'posts', 'post_count', 'series_count',
            'page_number', 'page_count', 'author_tags',
            'search_query', 'tag_filter'
        ]

        for field in required_fields:
            with self.subTest(field=field):
                self.assertIn(field, response.context)

    def test_author_posts_page_with_search(self):
        """작가 포스트 페이지 검색 기능 테스트"""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username}) + '?q=Test'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['search_query'], 'Test')

    def test_author_posts_page_with_tag_filter(self):
        """작가 포스트 페이지 태그 필터 테스트"""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username}) + '?tag=python'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['tag_filter'], 'python')

    def test_author_posts_page_ignores_legacy_sort_parameter(self):
        """작가 포스트 페이지는 최신순 고정이며 legacy sort 파라미터를 노출하지 않는다."""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username}) + '?sort=popular'
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('sort_option', response.context)

    def test_nonexistent_author_returns_404(self):
        """존재하지 않는 작가 페이지 접근 시 404 반환"""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': 'nonexistent'})
        )
        self.assertEqual(response.status_code, 404)

    def test_author_with_no_posts(self):
        """포스트가 없는 작가 페이지 정상 렌더링"""
        new_user = User.objects.create_user(
            username='newauthor',
            email='new@example.com',
            password='testpass123'
        )
        # Create profile with EDITOR role
        Profile.objects.create(
            user=new_user,
            role=Profile.Role.EDITOR
        )

        response = self.client.get(
            reverse('user_posts', kwargs={'username': new_user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['post_count'], 0)

    def test_author_without_profile(self):
        """프로필이 없는 작가 - overview 페이지는 정상 렌더링"""
        new_user = User.objects.create_user(
            username='noprofile',
            email='noprofile@example.com',
            password='testpass123'
        )

        response = self.client.get(
            reverse('user_profile', kwargs={'username': new_user.username})
        )
        # Overview 페이지는 프로필 없이도 표시 가능
        self.assertEqual(response.status_code, 200)

    def test_reader_can_access_overview(self):
        """READER 역할 사용자도 overview 페이지 정상 접근"""
        reader_user = User.objects.create_user(
            username='reader',
            email='reader@example.com',
            password='testpass123'
        )
        # Create profile with READER role (default)
        Profile.objects.create(
            user=reader_user,
            role=Profile.Role.READER
        )

        response = self.client.get(
            reverse('user_profile', kwargs={'username': reader_user.username})
        )
        # Overview는 모두에게 공개
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author_reader_overview.html')

    def test_editor_can_access_posts(self):
        """EDITOR 역할 사용자는 posts 페이지 정상 접근"""
        editor_user = User.objects.create_user(
            username='editor',
            email='editor@example.com',
            password='testpass123'
        )
        Profile.objects.create(
            user=editor_user,
            role=Profile.Role.EDITOR
        )

        response = self.client.get(
            reverse('user_posts', kwargs={'username': editor_user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author_posts.html')


class AuthorSeriesPageTestCase(TestCase):
    """작가 시리즈 페이지 (@<username>/series) 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testauthor',
            email='author@example.com',
            password='testpass123'
        )
        # Create profile with EDITOR role
        Profile.objects.create(
            user=self.user,
            role=Profile.Role.EDITOR
        )

        # 시리즈 생성
        self.series = Series.objects.create(
            owner=self.user,
            name='Test Series',
            url='test-series',
            text_md='Series description',
            text_html='<p>Series description</p>',
            hide=False
        )

    def test_author_series_page_renders(self):
        """작가 시리즈 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author_series.html')
        self.assertContains(response, '시리즈 검색')
        self.assertContains(response, 'w-full lg:w-44')
        self.assertContains(response, 'relative w-full')
        self.assertContains(response, 'flex w-full items-center justify-between')
        self.assertNotContains(response, 'sm:w-48')

    def test_author_series_page_has_required_context(self):
        """작가 시리즈 페이지 컨텍스트에 필수 필드 확인"""
        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username})
        )

        required_fields = [
            'author', 'series_list', 'post_count', 'series_count',
            'is_loading', 'author_tags', 'search_query', 'sort_option',
            'page_number', 'page_count'
        ]

        for field in required_fields:
            with self.subTest(field=field):
                self.assertIn(field, response.context)

    def test_author_series_page_sorting_custom(self):
        """작가 시리즈 페이지 작가 지정 순 정렬 테스트"""
        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username}) + '?sort=custom'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['sort_option'], 'custom')

    def test_author_series_page_sorting_newest(self):
        """작가 시리즈 페이지 최신순 정렬 테스트"""
        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username}) + '?sort=newest'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['sort_option'], 'newest')

    def test_author_series_page_sorting_oldest(self):
        """작가 시리즈 페이지 오래된순 정렬 테스트"""
        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username}) + '?sort=oldest'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['sort_option'], 'oldest')

    def test_author_series_page_sorting_posts(self):
        """작가 시리즈 페이지 포스트 많은 순 정렬 테스트"""
        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username}) + '?sort=posts'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['sort_option'], 'posts')

    def test_author_series_page_with_search(self):
        """작가 시리즈 페이지 검색 기능 테스트"""
        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username}) + '?q=Test'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['search_query'], 'Test')

    def test_nonexistent_author_series_returns_404(self):
        """존재하지 않는 작가의 시리즈 페이지 접근 시 404 반환"""
        response = self.client.get(
            reverse('user_series', kwargs={'username': 'nonexistent'})
        )
        self.assertEqual(response.status_code, 404)

    def test_author_with_no_series(self):
        """시리즈가 없는 작가의 시리즈 페이지 정상 렌더링"""
        new_user = User.objects.create_user(
            username='newauthor',
            email='new@example.com',
            password='testpass123'
        )
        # Create profile with EDITOR role
        Profile.objects.create(
            user=new_user,
            role=Profile.Role.EDITOR
        )

        response = self.client.get(
            reverse('user_series', kwargs={'username': new_user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['series_count'], 0)

    def test_series_without_posts(self):
        """포스트가 없는 시리즈는 목록에 표시되지 않아야 함"""
        empty_series = Series.objects.create(
            owner=self.user,
            name='Empty Series',
            url='empty-series',
            text_md='Empty series description',
            text_html='<p>Empty series description</p>',
            hide=False
        )

        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username})
        )
        self.assertEqual(response.status_code, 200)
        # test-series는 setUp에서 생성했지만 포스트가 없음, 그래서 0개여야 함
        self.assertEqual(len(response.context['series_list']), 0)
        
    def test_series_with_hidden_posts(self):
        """숨김 처리된 포스트는 카운트에서 제외되어야 하며, 모든 포스트가 숨겨지면 시리즈도 제외됨"""
        # setUp에서 생성된 test-series에 포스트 추가
        post1 = Post.objects.create(
            title='Hidden Post',
            url='hidden-post-url',
            author=self.user,
            series=self.series,
            published_date=timezone.now()
        )
        PostConfig.objects.create(post=post1, hide=True)

        post2 = Post.objects.create(
            title='Visible Post',
            url='visible-post-url',
            author=self.user,
            series=self.series,
            published_date=timezone.now()
        )
        PostConfig.objects.create(post=post2, hide=False)
        
        # 1. 하나는 숨김, 하나는 공개일 때 -> 카운트 1개로 표시, 목록에 나타남
        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context['series_list']), 1)
        self.assertEqual(response.context['series_list'][0].post_count, 1)
        
        # 2. 둘 다 숨김일 때 -> 목록에서 사라짐
        post2.config.hide = True
        post2.config.save()
        
        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context['series_list']), 0)

    def test_reader_redirected_to_about_from_series(self):
        """READER 역할 사용자의 series 페이지 접근 시 overview로 리다이렉트"""
        reader_user = User.objects.create_user(
            username='reader',
            email='reader@example.com',
            password='testpass123'
        )
        # Create profile with READER role (default)
        Profile.objects.create(
            user=reader_user,
            role=Profile.Role.READER
        )

        response = self.client.get(
            reverse('user_series', kwargs={'username': reader_user.username})
        )
        # READER는 overview 페이지로 리다이렉트 (about는 다시 overview로 리다이렉트)
        self.assertEqual(response.status_code, 302)
        # Follow redirect to check final destination
        final_response = self.client.get(
            reverse('user_series', kwargs={'username': reader_user.username}),
            follow=True
        )
        self.assertEqual(final_response.status_code, 200)

    def test_editor_can_access_series(self):
        """EDITOR 역할 사용자는 series 페이지 정상 접근"""
        editor_user = User.objects.create_user(
            username='editor',
            email='editor@example.com',
            password='testpass123'
        )
        Profile.objects.create(
            user=editor_user,
            role=Profile.Role.EDITOR
        )

        response = self.client.get(
            reverse('user_series', kwargs={'username': editor_user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author_series.html')


class AuthorAboutPageTestCase(TestCase):
    """작가 소개 페이지 (@<username>/about) 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testauthor',
            email='author@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )

        # 프로필 생성
        self.profile = Profile.objects.create(
            user=self.user,
            about_md='Test about content',
            about_html='<p>Test about content</p>',
            role=Profile.Role.EDITOR
        )

    def test_author_about_page_renders(self):
        """작가 소개 페이지는 overview로 리다이렉트"""
        response = self.client.get(
            reverse('user_about', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('user_profile', kwargs={'username': self.user.username}))

    def test_author_about_page_has_required_context(self):
        """작가 overview 페이지 컨텍스트에 필수 필드 확인 (redirect 후)"""
        response = self.client.get(
            reverse('user_about', kwargs={'username': self.user.username}),
            follow=True
        )

        required_fields = [
            'author', 'featured_posts_section', 'pinned_posts', 'recent_activities',
            'about_html', 'post_count', 'series_count'
        ]

        for field in required_fields:
            with self.subTest(field=field):
                self.assertIn(field, response.context)

    def test_nonexistent_author_about_returns_404(self):
        """존재하지 않는 작가의 소개 페이지 접근 시 리다이렉트 시도 후 404"""
        response = self.client.get(
            reverse('user_about', kwargs={'username': 'nonexistent'})
        )
        # Redirect는 발생하지만, overview에서 404 발생
        self.assertEqual(response.status_code, 302)

    def test_author_about_edit_requires_login(self):
        """작가 소개 편집 페이지는 로그인 필요"""
        response = self.client.get(
            reverse('user_about_edit', kwargs={'username': self.user.username})
        )
        # 로그인하지 않으면 리다이렉트
        self.assertEqual(response.status_code, 302)

    def test_author_about_edit_requires_ownership(self):
        """작가 소개 편집은 본인만 가능 (403 에러)"""
        # 다른 사용자로 로그인
        self.client.login(username='otheruser', password='testpass123')

        response = self.client.get(
            reverse('user_about_edit', kwargs={'username': self.user.username})
        )
        # 권한 없음
        self.assertEqual(response.status_code, 403)

    def test_author_about_edit_with_correct_user(self):
        """본인의 작가 소개 편집 페이지 정상 접근"""
        self.client.login(username='testauthor', password='testpass123')

        response = self.client.get(
            reverse('user_about_edit', kwargs={'username': self.user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author_about_edit.html')
        self.assertContains(response, 'x-ref=formData')

    def test_author_about_edit_post_returns_rendered_content(self):
        """소개글 저장 응답은 새로고침 없이 반영할 수 있는 렌더 HTML을 반환한다."""
        self.client.login(username='testauthor', password='testpass123')
        about_md = '# Updated Intro\n\nThis is **bold**.'

        response = self.client.post(
            reverse('user_about_edit', kwargs={'username': self.user.username}),
            {'about_md': about_md},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['about_md'], about_md)
        self.assertIn('Updated Intro', data['about_html'])
        self.assertIn('<strong>bold</strong>', data['about_html'])

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.about_md, about_md)
        self.assertEqual(self.profile.about_html, data['about_html'])

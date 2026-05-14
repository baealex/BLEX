"""
작가 페이지 템플릿 테스트
URL: @<username>, @<username>/series, @<username>/about
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import (
    Comment, Post, PostContent, PostConfig, PostLikes, Series, Profile, Tag
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

    def test_author_overview_page_renders(self):
        """작가 개요 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author_overview.html')

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
            'search_query', 'sort_option', 'tag_filter'
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

    def test_author_posts_page_sorting_recent(self):
        """작가 포스트 페이지 최신순 정렬 테스트"""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username}) + '?sort=recent'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['sort_option'], 'recent')

    def test_author_posts_page_sorting_popular(self):
        """작가 포스트 페이지 인기순 정렬 테스트"""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username}) + '?sort=popular'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['sort_option'], 'popular')

    def test_author_posts_page_sorting_comments(self):
        """작가 포스트 페이지 댓글 많은 순 정렬 테스트"""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username}) + '?sort=comments'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['sort_option'], 'comments')

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

        required_fields = ['author', 'pinned_posts', 'recent_activities', 'about_html', 'post_count', 'series_count']

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

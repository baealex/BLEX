"""
작가 페이지 템플릿 테스트
URL: @<username>, @<username>/series, @<username>/about
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent, PostConfig, Series, Profile, Tag


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
            created_date=timezone.now()
        )
        PostContent.objects.create(
            post=self.post,
            text_md='# Author Content',
            text_html='<h1>Author Content</h1>'
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False,
            notice=False,
            advertise=False
        )

        # 태그 추가
        self.tag = Tag.objects.create(value='python')
        self.post.tags.add(self.tag)

    def test_author_posts_page_renders(self):
        """작가 포스트 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author.html')

    def test_author_posts_page_has_required_context(self):
        """작가 포스트 페이지 컨텍스트에 필수 필드 확인"""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username})
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
            reverse('user_profile', kwargs={'username': self.user.username}) + '?q=Test'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['search_query'], 'Test')

    def test_author_posts_page_with_tag_filter(self):
        """작가 포스트 페이지 태그 필터 테스트"""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username}) + '?tag=python'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['tag_filter'], 'python')

    def test_author_posts_page_sorting_recent(self):
        """작가 포스트 페이지 최신순 정렬 테스트"""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username}) + '?sort=recent'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['sort_option'], 'recent')

    def test_author_posts_page_sorting_popular(self):
        """작가 포스트 페이지 인기순 정렬 테스트"""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username}) + '?sort=popular'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['sort_option'], 'popular')

    def test_author_posts_page_sorting_comments(self):
        """작가 포스트 페이지 댓글 많은 순 정렬 테스트"""
        response = self.client.get(
            reverse('user_profile', kwargs={'username': self.user.username}) + '?sort=comments'
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
            reverse('user_profile', kwargs={'username': new_user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['post_count'], 0)

    def test_author_without_profile(self):
        """프로필이 없는 작가 페이지 접근 - about 페이지로 리다이렉트"""
        new_user = User.objects.create_user(
            username='noprofile',
            email='noprofile@example.com',
            password='testpass123'
        )

        response = self.client.get(
            reverse('user_profile', kwargs={'username': new_user.username})
        )
        # Profile이 없으면 about 페이지로 리다이렉트
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('user_about', kwargs={'username': new_user.username}))

    def test_reader_redirected_to_about(self):
        """READER 역할 사용자의 posts 페이지 접근 시 about으로 리다이렉트"""
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
        # READER는 about 페이지로 리다이렉트
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('user_about', kwargs={'username': reader_user.username}))

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
            reverse('user_profile', kwargs={'username': editor_user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author.html')

    def test_admin_can_access_posts(self):
        """ADMIN 역할 사용자는 posts 페이지 정상 접근"""
        admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123'
        )
        Profile.objects.create(
            user=admin_user,
            role=Profile.Role.ADMIN
        )

        response = self.client.get(
            reverse('user_profile', kwargs={'username': admin_user.username})
        )
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author.html')


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
        """포스트가 없는 시리즈 렌더링"""
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

    def test_reader_redirected_to_about_from_series(self):
        """READER 역할 사용자의 series 페이지 접근 시 about으로 리다이렉트"""
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
        # READER는 about 페이지로 리다이렉트
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('user_about', kwargs={'username': reader_user.username}))

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

    def test_admin_can_access_series(self):
        """ADMIN 역할 사용자는 series 페이지 정상 접근"""
        admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123'
        )
        Profile.objects.create(
            user=admin_user,
            role=Profile.Role.ADMIN
        )

        response = self.client.get(
            reverse('user_series', kwargs={'username': admin_user.username})
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
            about_html='<p>Test about content</p>'
        )

    def test_author_about_page_renders(self):
        """작가 소개 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(
            reverse('user_about', kwargs={'username': self.user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author_about.html')

    def test_author_about_page_has_required_context(self):
        """작가 소개 페이지 컨텍스트에 필수 필드 확인"""
        response = self.client.get(
            reverse('user_about', kwargs={'username': self.user.username})
        )

        required_fields = ['author', 'about_content', 'post_count', 'series_count']

        for field in required_fields:
            with self.subTest(field=field):
                self.assertIn(field, response.context)

    def test_nonexistent_author_about_returns_404(self):
        """존재하지 않는 작가의 소개 페이지 접근 시 404 반환"""
        response = self.client.get(
            reverse('user_about', kwargs={'username': 'nonexistent'})
        )
        self.assertEqual(response.status_code, 404)

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

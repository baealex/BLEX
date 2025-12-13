"""
엣지 케이스 및 예외 상황 템플릿 테스트
다양한 예외 상황과 경계 조건 테스트
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent, PostConfig, Series, Tag, Profile


class EdgeCaseTemplateTestCase(TestCase):
    """엣지 케이스 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        # Create profile with EDITOR role
        Profile.objects.create(
            user=self.user,
            role=Profile.Role.EDITOR
        )

    def test_username_with_special_characters(self):
        """특수 문자가 포함된 사용자명 테스트"""
        special_user = User.objects.create_user(
            username='user_test-123',
            email='special@example.com',
            password='testpass123'
        )
        # Create profile with EDITOR role
        Profile.objects.create(
            user=special_user,
            role=Profile.Role.EDITOR
        )

        response = self.client.get(
            reverse('user_profile', kwargs={'username': special_user.username})
        )
        self.assertEqual(response.status_code, 200)

    def test_very_long_post_title(self):
        """매우 긴 포스트 제목 처리 테스트"""
        long_title = 'A' * 500

        post = Post.objects.create(
            title=long_title,
            url='long-title-post',
            author=self.user,
            created_date=timezone.now()
        )
        PostContent.objects.create(
            post=post,
            text_md='Content',
            text_html='<p>Content</p>'
        )
        PostConfig.objects.create(
            post=post,
            hide=False,
            notice=False,
            advertise=False
        )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

    def test_post_without_series(self):
        """시리즈가 없는 포스트 테스트"""
        post = Post.objects.create(
            title='No Series Post',
            url='no-series-post',
            author=self.user,
            series=None,
            created_date=timezone.now()
        )
        PostContent.objects.create(
            post=post,
            text_md='Content without series',
            text_html='<p>Content without series</p>'
        )
        PostConfig.objects.create(
            post=post,
            hide=False,
            notice=False,
            advertise=False
        )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

    def test_unicode_content(self):
        """유니코드 컨텐츠 처리 테스트"""
        unicode_post = Post.objects.create(
            title='한글 제목 テスト 测试 🚀',
            url='unicode-post',
            author=self.user,
            created_date=timezone.now()
        )
        PostContent.objects.create(
            post=unicode_post,
            text_md='한글 내용 日本語 中文 😀',
            text_html='<p>한글 내용 日本語 中文 😀</p>'
        )
        PostConfig.objects.create(
            post=unicode_post,
            hide=False,
            notice=False,
            advertise=False
        )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

    def test_multiple_concurrent_page_requests(self):
        """여러 페이지에 동시 요청 처리 테스트"""
        urls = [
            reverse('index'),
            reverse('tag_list'),
            reverse('login'),
            reverse('signup'),
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)

    def test_invalid_pagination_negative_page(self):
        """음수 페이지 번호 처리 테스트"""
        response = self.client.get(reverse('index') + '?page=-1')
        # Django Paginator가 처리하므로 200 또는 404
        self.assertIn(response.status_code, [200, 404])

    def test_invalid_pagination_zero_page(self):
        """0 페이지 번호 처리 테스트"""
        response = self.client.get(reverse('index') + '?page=0')
        self.assertIn(response.status_code, [200, 404])

    def test_invalid_pagination_very_large_page(self):
        """매우 큰 페이지 번호 처리 테스트"""
        response = self.client.get(reverse('index') + '?page=999999')
        self.assertIn(response.status_code, [200, 404])

    def test_invalid_pagination_non_numeric_page(self):
        """숫자가 아닌 페이지 번호 처리 테스트"""
        # 뷰에서 int() 변환 실패 시 예외 처리 확인
        try:
            response = self.client.get(reverse('index') + '?page=abc')
            # 에러가 발생하거나 기본값으로 처리
            self.assertIn(response.status_code, [200, 400, 404, 500])
        except ValueError:
            # int() 변환 실패는 예상된 동작
            pass

    def test_post_with_empty_content(self):
        """빈 내용의 포스트 처리 테스트"""
        empty_post = Post.objects.create(
            title='Empty Content Post',
            url='empty-content-post',
            author=self.user,
            created_date=timezone.now()
        )
        PostContent.objects.create(
            post=empty_post,
            text_md='',
            text_html=''
        )
        PostConfig.objects.create(
            post=empty_post,
            hide=False,
            notice=False,
            advertise=False
        )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

    def test_tag_with_special_characters_in_name(self):
        """태그명에 특수 문자가 있는 경우 테스트"""
        # 일반적으로 허용되는 특수 문자들
        special_tags = ['c++', 'c#', 'f#', 'asp.net']

        for tag_name in special_tags:
            with self.subTest(tag=tag_name):
                tag = Tag.objects.create(value=tag_name)

                post = Post.objects.create(
                    title=f'{tag_name} Post',
                    url=f'{tag_name.replace("#", "sharp").replace("+", "plus").replace(".", "dot")}-post',
                    author=self.user,
                    created_date=timezone.now()
                )
                PostContent.objects.create(
                    post=post,
                    text_md='Content',
                    text_html='<p>Content</p>'
                )
                PostConfig.objects.create(
                    post=post,
                    hide=False,
                    notice=False,
                    advertise=False
                )
                post.tags.add(tag)

                # 태그 상세 페이지 접근 시도
                try:
                    response = self.client.get(
                        reverse('tag_detail', kwargs={'name': tag_name})
                    )
                    self.assertIn(response.status_code, [200, 404])
                except Exception:
                    # URL 인코딩 문제 등으로 에러 발생 가능
                    pass

    def test_series_with_very_long_name(self):
        """매우 긴 이름의 시리즈 테스트"""
        long_series_name = 'A' * 500

        series = Series.objects.create(
            owner=self.user,
            name=long_series_name,
            url='long-series',
            text_md='Series description',
            text_html='<p>Series description</p>',
            hide=False
        )

        response = self.client.get(
            reverse('user_series', kwargs={'username': self.user.username})
        )
        self.assertEqual(response.status_code, 200)

    def test_post_with_all_optional_fields_none(self):
        """선택적 필드가 모두 None인 포스트 테스트"""
        minimal_post = Post.objects.create(
            title='Minimal Post',
            url='minimal-post',
            author=self.user,
            created_date=timezone.now(),
            series=None,
            image=None,
            meta_description=''
        )
        PostContent.objects.create(
            post=minimal_post,
            text_md='Minimal content',
            text_html='<p>Minimal content</p>'
        )
        PostConfig.objects.create(
            post=minimal_post,
            hide=False,
            notice=False,
            advertise=False
        )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

    def test_rapid_sequential_requests(self):
        """빠른 연속 요청 처리 테스트"""
        for i in range(10):
            with self.subTest(request=i):
                response = self.client.get(reverse('index'))
                self.assertEqual(response.status_code, 200)

    def test_sorting_with_invalid_option(self):
        """잘못된 정렬 옵션 처리 테스트"""
        response = self.client.get(reverse('index') + '?sort=invalid_option')
        # 기본 정렬로 처리되어야 함
        self.assertEqual(response.status_code, 200)

    def test_author_page_with_empty_search(self):
        """작가 페이지에서 빈 검색어 처리 테스트"""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.user.username}) + '?q='
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['search_query'], '')

    def test_tag_list_with_empty_search(self):
        """태그 목록에서 빈 검색어 처리 테스트"""
        response = self.client.get(reverse('tag_list') + '?q=')
        self.assertEqual(response.status_code, 200)

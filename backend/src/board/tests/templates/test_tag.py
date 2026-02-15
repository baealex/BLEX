"""
태그 페이지 템플릿 테스트
URL: /tags, /tag/<name>
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent, PostConfig, Tag


class TagListPageTestCase(TestCase):
    """태그 목록 페이지 (/tags) 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # 여러 태그와 포스트 생성
        tags_data = ['python', 'django', 'javascript', 'react']
        for tag_name in tags_data:
            tag = Tag.objects.create(value=tag_name)

            # 각 태그에 대한 포스트 생성
            for i in range(3):
                post = Post.objects.create(
                    title=f'{tag_name} Post {i}',
                    url=f'{tag_name}-post-{i}',
                    author=self.user,
                    created_date=timezone.now(),
                    published_date=timezone.now()
                )
                PostContent.objects.create(
                    post=post,
                    text_md=f'Content about {tag_name}',
                    text_html=f'<p>Content about {tag_name}</p>'
                )
                PostConfig.objects.create(
                    post=post,
                    hide=False,
        
                    advertise=False
                )
                post.tags.add(tag)

    def test_tag_list_page_renders(self):
        """태그 목록 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(reverse('tag_list'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/tags/tag_list.html')

    def test_tag_list_sorting_popular(self):
        """태그 목록 인기순 정렬 테스트"""
        response = self.client.get(reverse('tag_list') + '?sort=popular')
        self.assertEqual(response.status_code, 200)

    def test_tag_list_sorting_name(self):
        """태그 목록 이름순 정렬 테스트"""
        response = self.client.get(reverse('tag_list') + '?sort=name')
        self.assertEqual(response.status_code, 200)

    def test_tag_list_sorting_recent(self):
        """태그 목록 최신순 정렬 테스트"""
        response = self.client.get(reverse('tag_list') + '?sort=recent')
        self.assertEqual(response.status_code, 200)

    def test_tag_list_with_search(self):
        """태그 목록 검색 테스트"""
        response = self.client.get(reverse('tag_list') + '?q=python')
        self.assertEqual(response.status_code, 200)

    def test_tag_list_pagination(self):
        """태그 목록 페이지네이션 테스트"""
        response = self.client.get(reverse('tag_list') + '?page=1')
        self.assertEqual(response.status_code, 200)


class TagDetailPageTestCase(TestCase):
    """태그 상세 페이지 (/tag/<name>) 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # 태그와 포스트 생성
        self.tag = Tag.objects.create(value='python')

        for i in range(5):
            post = Post.objects.create(
                title=f'Python Post {i}',
                url=f'python-post-{i}',
                author=self.user,
                created_date=timezone.now(),
                published_date=timezone.now()
            )
            PostContent.objects.create(
                post=post,
                text_md=f'Python content {i}',
                text_html=f'<p>Python content {i}</p>'
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
    
                advertise=False
            )
            post.tags.add(self.tag)

    def test_tag_detail_page_renders(self):
        """태그 상세 페이지가 정상적으로 렌더링되는지 테스트"""
        response = self.client.get(reverse('tag_detail', kwargs={'name': 'python'}))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/tags/tag_detail.html')

    def test_tag_detail_page_has_required_context(self):
        """태그 상세 페이지 컨텍스트에 필수 필드 확인"""
        response = self.client.get(reverse('tag_detail', kwargs={'name': 'python'}))

        required_fields = ['tag', 'posts', 'page', 'last_page']

        for field in required_fields:
            with self.subTest(field=field):
                self.assertIn(field, response.context)

    def test_tag_detail_page_shows_correct_tag(self):
        """태그 상세 페이지에서 올바른 태그 표시"""
        response = self.client.get(reverse('tag_detail', kwargs={'name': 'python'}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['tag'], 'python')

    def test_tag_detail_pagination(self):
        """태그 상세 페이지 페이지네이션 테스트"""
        response = self.client.get(
            reverse('tag_detail', kwargs={'name': 'python'}) + '?page=1'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['page'], 1)

    def test_tag_with_no_posts_returns_404(self):
        """포스트가 없는 태그 접근 시 404 반환"""
        # 포스트가 없는 태그 생성
        Tag.objects.create(value='emptytag')

        response = self.client.get(
            reverse('tag_detail', kwargs={'name': 'emptytag'})
        )
        # tag_detail_view는 포스트가 없으면 404 반환
        self.assertEqual(response.status_code, 404)

    def test_nonexistent_tag_returns_404(self):
        """존재하지 않는 태그 접근 시 404 반환"""
        # 태그를 생성하지 않고 바로 접근
        response = self.client.get(
            reverse('tag_detail', kwargs={'name': 'nonexistent'})
        )
        # 포스트가 없으면 404
        self.assertEqual(response.status_code, 404)

    def test_tag_detail_does_not_show_hidden_posts(self):
        """태그 상세 페이지에서 숨겨진 포스트가 표시되지 않는지 테스트"""
        hidden_post = Post.objects.create(
            title='Hidden Python Post',
            url='hidden-python-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now()
        )
        PostContent.objects.create(
            post=hidden_post,
            text_md='Hidden content',
            text_html='<p>Hidden content</p>'
        )
        PostConfig.objects.create(
            post=hidden_post,
            hide=True,

            advertise=False
        )
        hidden_post.tags.add(self.tag)

        response = self.client.get(reverse('tag_detail', kwargs={'name': 'python'}))
        posts = list(response.context['posts'])
        post_titles = [post.title for post in posts]

        self.assertNotIn('Hidden Python Post', post_titles)

    def test_tag_with_unicode_name(self):
        """유니코드 태그명 테스트"""
        unicode_tag = Tag.objects.create(value='파이썬')

        post = Post.objects.create(
            title='Korean Python Post',
            url='korean-python-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now()
        )
        PostContent.objects.create(
            post=post,
            text_md='Korean content',
            text_html='<p>Korean content</p>'
        )
        PostConfig.objects.create(
            post=post,
            hide=False,

            advertise=False
        )
        post.tags.add(unicode_tag)

        response = self.client.get(reverse('tag_detail', kwargs={'name': '파이썬'}))
        self.assertEqual(response.status_code, 200)

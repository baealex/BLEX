"""
Tag page template tests.
URL: /tags, /tag/<name>
"""
from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, Tag


class TagListPageTestCase(TestCase):
    """Template tests for the tag list page."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

        tags_data = ['python', 'django', 'javascript', 'react']
        for tag_name in tags_data:
            tag = Tag.objects.create(value=tag_name)

            for i in range(3):
                post = Post.objects.create(
                    title=f'{tag_name} Post {i}',
                    url=f'{tag_name}-post-{i}',
                    author=self.user,
                    created_date=timezone.now(),
                    published_date=timezone.now(),
                )
                PostContent.objects.create(
                    post=post,
                    content_html=f'<p>Content about {tag_name}</p>',
                )
                PostConfig.objects.create(
                    post=post,
                    hide=False,
                    advertise=False,
                )
                post.tags.add(tag)


    def create_tagged_post(self, title, url, tag, published_date, hide=False):
        post = Post.objects.create(
            title=title,
            url=url,
            author=self.user,
            created_date=timezone.now(),
            published_date=published_date,
        )
        PostContent.objects.create(
            post=post,
            content_html=f'<p>{title} content</p>',
        )
        PostConfig.objects.create(
            post=post,
            hide=hide,
            advertise=False,
        )
        post.tags.add(tag)
        return post

    def test_tag_list_page_renders(self):
        response = self.client.get(reverse('tag_list'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/tags/tag_list.html')


    def test_tag_list_counts_public_posts_only(self):
        """태그 목록은 공개 글에 연결된 태그만 집계한다."""
        private_tag = Tag.objects.create(value='private-only')
        self.create_tagged_post(
            'Draft Private Tag Post',
            'draft-private-tag-post',
            private_tag,
            None,
        )
        self.create_tagged_post(
            'Future Private Tag Post',
            'future-private-tag-post',
            private_tag,
            timezone.now() + timezone.timedelta(days=1),
        )
        self.create_tagged_post(
            'Hidden Private Tag Post',
            'hidden-private-tag-post',
            private_tag,
            timezone.now(),
            hide=True,
        )

        response = self.client.get(reverse('tag_list'))

        self.assertEqual(response.status_code, 200)
        tag_names = [tag['name'] for tag in response.context['tags']]
        self.assertNotIn('private-only', tag_names)

    def test_tag_list_supports_sort_options(self):
        for sort_type in ['popular', 'name', 'recent']:
            with self.subTest(sort_type=sort_type):
                response = self.client.get(reverse('tag_list') + f'?sort={sort_type}')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.context['page'], 1)

    def test_tag_list_search_filters_results(self):
        response = self.client.get(reverse('tag_list') + '?q=python')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context['tags']), 1)
        self.assertEqual(response.context['tags'][0]['name'], 'python')

    def test_tag_list_pagination_query_is_supported(self):
        response = self.client.get(reverse('tag_list') + '?page=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['page'], 1)


class TagDetailPageTestCase(TestCase):
    """Template tests for the tag detail page."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

        self.tag = Tag.objects.create(value='python')

        for i in range(5):
            post = Post.objects.create(
                title=f'Python Post {i}',
                url=f'python-post-{i}',
                author=self.user,
                created_date=timezone.now(),
                published_date=timezone.now(),
            )
            PostContent.objects.create(
                post=post,
                content_html=f'<p>Python content {i}</p>',
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )
            post.tags.add(self.tag)


    def create_tagged_post(self, title, url, published_date, hide=False):
        post = Post.objects.create(
            title=title,
            url=url,
            author=self.user,
            created_date=timezone.now(),
            published_date=published_date,
        )
        PostContent.objects.create(
            post=post,
            content_html=f'<p>{title} content</p>',
        )
        PostConfig.objects.create(
            post=post,
            hide=hide,
            advertise=False,
        )
        post.tags.add(self.tag)
        return post

    def test_tag_detail_page_renders(self):
        response = self.client.get(reverse('tag_detail', kwargs={'name': 'python'}))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/tags/tag_detail.html')

    def test_tag_detail_page_has_required_context(self):
        response = self.client.get(reverse('tag_detail', kwargs={'name': 'python'}))

        required_fields = ['tag', 'posts', 'page', 'last_page']
        for field in required_fields:
            with self.subTest(field=field):
                self.assertIn(field, response.context)


    def test_tag_detail_shows_public_posts_only(self):
        """태그 상세는 숨김, 임시저장, 미래 발행 글을 노출하지 않는다."""
        self.create_tagged_post('Draft Python Post', 'draft-python-post', None)
        self.create_tagged_post(
            'Future Python Post',
            'future-python-post',
            timezone.now() + timezone.timedelta(days=1),
        )
        self.create_tagged_post('Hidden Python Post', 'hidden-python-post', timezone.now(), hide=True)

        response = self.client.get(reverse('tag_detail', kwargs={'name': 'python'}))

        self.assertEqual(response.status_code, 200)
        post_titles = [post.title for post in response.context['posts']]
        self.assertNotIn('Draft Python Post', post_titles)
        self.assertNotIn('Future Python Post', post_titles)
        self.assertNotIn('Hidden Python Post', post_titles)

    def test_tag_detail_page_shows_correct_tag(self):
        response = self.client.get(reverse('tag_detail', kwargs={'name': 'python'}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['tag'], 'python')

    def test_tag_detail_pagination(self):
        response = self.client.get(
            reverse('tag_detail', kwargs={'name': 'python'}) + '?page=1'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['page'], 1)

    def test_tag_with_no_posts_returns_404(self):
        Tag.objects.create(value='emptytag')

        response = self.client.get(
            reverse('tag_detail', kwargs={'name': 'emptytag'})
        )
        self.assertEqual(response.status_code, 404)

    def test_nonexistent_tag_returns_404(self):
        response = self.client.get(
            reverse('tag_detail', kwargs={'name': 'nonexistent'})
        )
        self.assertEqual(response.status_code, 404)

    def test_tag_detail_does_not_show_hidden_posts(self):
        hidden_post = Post.objects.create(
            title='Hidden Python Post',
            url='hidden-python-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=hidden_post,
            content_html='<p>Hidden content</p>',
        )
        PostConfig.objects.create(
            post=hidden_post,
            hide=True,
            advertise=False,
        )
        hidden_post.tags.add(self.tag)

        response = self.client.get(reverse('tag_detail', kwargs={'name': 'python'}))
        posts = list(response.context['posts'])
        post_titles = [post.title for post in posts]

        self.assertNotIn('Hidden Python Post', post_titles)

    def test_tag_with_unicode_name(self):
        unicode_tag = Tag.objects.create(value='태그')

        post = Post.objects.create(
            title='Unicode Tag Post',
            url='unicode-tag-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=post,
            content_html='<p>Unicode content</p>',
        )
        PostConfig.objects.create(
            post=post,
            hide=False,
            advertise=False,
        )
        post.tags.add(unicode_tag)

        response = self.client.get(reverse('tag_detail', kwargs={'name': '태그'}))
        self.assertEqual(response.status_code, 200)

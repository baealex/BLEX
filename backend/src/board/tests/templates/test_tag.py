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
                    text_md=f'Content about {tag_name}',
                    text_html=f'<p>Content about {tag_name}</p>',
                )
                PostConfig.objects.create(
                    post=post,
                    hide=False,
                    advertise=False,
                )
                post.tags.add(tag)

    def test_tag_list_page_renders(self):
        response = self.client.get(reverse('tag_list'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/tags/tag_list.html')

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
                text_md=f'Python content {i}',
                text_html=f'<p>Python content {i}</p>',
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )
            post.tags.add(self.tag)

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
            text_md='Hidden content',
            text_html='<p>Hidden content</p>',
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
            text_md='Unicode content',
            text_html='<p>Unicode content</p>',
        )
        PostConfig.objects.create(
            post=post,
            hide=False,
            advertise=False,
        )
        post.tags.add(unicode_tag)

        response = self.client.get(reverse('tag_detail', kwargs={'name': '태그'}))
        self.assertEqual(response.status_code, 200)

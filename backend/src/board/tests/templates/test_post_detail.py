"""
Tests for Post Detail View and ToC structure
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent, PostConfig

class PostDetailViewTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testauthor',
            email='test@example.com',
            password='password123'
        )
        self.post = Post.objects.create(
            title='Test Post',
            url='test-post',
            author=self.user,
            created_date=timezone.now()
        )
        # Create PostContent with headers
        PostContent.objects.create(
            post=self.post,
            text_md='# Header 1\n## Header 2',
            text_html='<h1>Header 1</h1><h2>Header 2</h2>'
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False
        )

    def test_post_detail_context_has_toc(self):
        url = reverse('post_detail', kwargs={
            'username': 'testauthor',
            'post_url': 'test-post'
        })
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('table_of_contents', response.context)
        
        toc = response.context['table_of_contents']

        self.assertEqual(len(toc), 2)
        self.assertEqual(toc[0]['text'], 'Header 1')
        self.assertEqual(toc[0]['level'], 1)
        self.assertEqual(toc[1]['text'], 'Header 2')
        self.assertEqual(toc[1]['level'], 2)

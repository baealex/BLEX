from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, Profile, SiteSetting


@override_settings(SITE_URL='https://blex.example')
class PostPreviewViewTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username='preview-owner',
            email='preview-owner@example.com',
            password='password123',
        )
        cls.other_user = User.objects.create_user(
            username='preview-other',
            email='preview-other@example.com',
            password='password123',
        )
        Profile.objects.update_or_create(
            user=cls.owner,
            defaults={'role': Profile.Role.EDITOR},
        )
        Profile.objects.update_or_create(
            user=cls.other_user,
            defaults={'role': Profile.Role.EDITOR},
        )

        cls.draft = Post.objects.create(
            author=cls.owner,
            title='Owner Draft Preview',
            subtitle='Preview subtitle',
            url='owner-draft-preview',
            meta_description='Private preview description',
            published_date=None,
        )
        PostContent.objects.create(
            post=cls.draft,
            content_html='<h2>Saved draft heading</h2><p>Saved draft body</p>',
        )
        PostConfig.objects.create(
            post=cls.draft,
            hide=True,
            advertise=True,
            block_comment=True,
            cover_layout='none',
        )

        cls.published_post = Post.objects.create(
            author=cls.owner,
            title='Published Post',
            url='published-post-preview-route',
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=cls.published_post,
            content_html='<p>Published body</p>',
        )
        PostConfig.objects.create(post=cls.published_post, hide=False)

    def setUp(self):
        setting = SiteSetting.get_instance()
        setting.seo_enabled = True
        setting.aeo_enabled = True
        setting.save(update_fields=['seo_enabled', 'aeo_enabled'])
        self.preview_url = reverse(
            'post_preview',
            kwargs={'post_url': self.draft.url},
        )

    def test_owner_can_render_latest_saved_draft_with_private_headers(self):
        self.client.force_login(self.owner)

        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(self.preview_url)

        self.assertEqual(len(captured), 9)

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/posts/post_detail.html')
        self.assertTrue(response.context['is_post_preview'])
        self.assertEqual(response.context['post_visibility_status'], 'draft')
        self.assertFalse(response.context['show_agent_post_markdown'])
        self.assertContains(response, 'Owner Draft Preview')
        self.assertContains(response, 'Saved draft body')
        self.assertContains(response, '임시 포스트 미리보기입니다')
        self.assertContains(response, 'noindex,nofollow,noarchive')
        self.assertNotContains(response, 'rel="canonical"')
        self.assertNotContains(response, 'application/rss+xml')
        self.assertNotContains(response, 'application/ld+json')
        self.assertNotContains(response, '게시물 공유 또는 링크 복사')
        self.assertNotContains(response, 'island-component name="Comments"')
        self.assertNotContains(response, 'island-component name="RelatedPosts"')
        self.assertEqual(
            response['X-Robots-Tag'],
            'noindex, nofollow, noarchive',
        )
        self.assertEqual(response['X-Frame-Options'], 'SAMEORIGIN')
        self.assertIn('private', response['Cache-Control'])
        self.assertIn('no-store', response['Cache-Control'])
        self.assertIn('Cookie', response['Vary'])
        self.assertNotIn('Link', response)
        self.assertNotIn('X-Llms-Txt', response)

        post_sql = ' '.join(query['sql'] for query in captured.captured_queries)
        self.assertNotIn('board_postlikes', post_sql.lower())

        self.draft.content.content_html = '<p>Newest saved preview body</p>'
        self.draft.content.save(update_fields=['content_html'])

        refreshed_response = self.client.get(self.preview_url)

        self.assertContains(refreshed_response, 'Newest saved preview body')
        self.assertNotContains(refreshed_response, 'Saved draft body')

    def test_preview_rejects_anonymous_and_other_users_without_leaking_draft(self):
        anonymous_response = self.client.get(self.preview_url)
        self.assertEqual(anonymous_response.status_code, 404)

        self.client.force_login(self.other_user)
        other_user_response = self.client.get(self.preview_url)
        self.assertEqual(other_user_response.status_code, 404)

    def test_preview_rejects_published_posts_and_non_get_requests(self):
        self.client.force_login(self.owner)

        published_response = self.client.get(reverse(
            'post_preview',
            kwargs={'post_url': self.published_post.url},
        ))
        post_response = self.client.post(self.preview_url)

        self.assertEqual(published_response.status_code, 404)
        self.assertEqual(post_response.status_code, 405)

    def test_preview_does_not_change_existing_public_discovery_contracts(self):
        self.client.force_login(self.owner)

        public_detail_response = self.client.get(reverse(
            'post_detail',
            kwargs={
                'username': self.owner.username,
                'post_url': self.draft.url,
            },
        ))
        markdown_response = self.client.get(reverse(
            'post_markdown',
            kwargs={
                'username': self.owner.username,
                'post_url': self.draft.url,
            },
        ))

        self.assertEqual(public_detail_response.status_code, 404)
        self.assertEqual(markdown_response.status_code, 404)

        for url in (
            reverse('site_rss_feed'),
            '/posts/sitemap.xml',
            reverse('llms_txt'),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertNotContains(response, self.draft.title)
                self.assertNotContains(response, self.preview_url)

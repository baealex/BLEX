import json

from django.test import TestCase
from django.utils import timezone

from board.models import User, Config, Profile, Post, PostContent, PostConfig, PinnedPost


class PinnedPostAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create test user
        cls.user = User.objects.create_user(
            username='testuser',
            password='testpass',
            email='test@test.com',
        )
        cls.profile = Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)

        # Create another user
        cls.other_user = User.objects.create_user(
            username='otheruser',
            password='testpass',
            email='other@test.com',
        )
        Profile.objects.create(user=cls.other_user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.other_user)

        # Create test posts
        cls.posts = []
        for i in range(8):
            post = Post.objects.create(
                author=cls.user,
                title=f'Test Post {i}',
                url=f'test-post-{i}',
                published_date=timezone.now(),
            )
            PostContent.objects.create(post=post, text_md='', text_html='')
            PostConfig.objects.create(post=post)
            cls.posts.append(post)

        # Create a hidden post
        cls.hidden_post = Post.objects.create(
            author=cls.user,
            title='Hidden Post',
            url='hidden-post',
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=cls.hidden_post, text_md='', text_html='')
        PostConfig.objects.create(post=cls.hidden_post, hide=True)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'
        # Clear pinned posts before each test
        PinnedPost.objects.all().delete()

    # GET /v1/users/@<username>/pinned-posts
    def test_get_pinned_posts_empty(self):
        """빈 고정 글 목록 조회"""
        response = self.client.get('/v1/users/@testuser/pinned-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['pinnedPosts'], [])
        self.assertEqual(content['body']['maxCount'], 6)

    def test_get_pinned_posts_with_data(self):
        """고정 글 목록 조회"""
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)
        PinnedPost.objects.create(user=self.user, post=self.posts[1], order=1)

        response = self.client.get('/v1/users/@testuser/pinned-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['pinnedPosts']), 2)
        self.assertEqual(content['body']['pinnedPosts'][0]['post']['url'], 'test-post-0')
        self.assertEqual(content['body']['pinnedPosts'][1]['post']['url'], 'test-post-1')

    def test_get_pinned_posts_nonexistent_user(self):
        """존재하지 않는 사용자의 고정 글 조회"""
        response = self.client.get('/v1/users/@nonexistent/pinned-posts')
        self.assertEqual(response.status_code, 404)

    # POST /v1/users/@<username>/pinned-posts
    def test_add_pinned_post_success(self):
        """고정 글 추가 성공"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post(
            '/v1/users/@testuser/pinned-posts',
            {'post_url': 'test-post-0'}
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # Verify pinned post was created
        self.assertTrue(PinnedPost.objects.filter(user=self.user, post=self.posts[0]).exists())

    def test_add_pinned_post_requires_login(self):
        """고정 글 추가는 로그인 필요"""
        response = self.client.post(
            '/v1/users/@testuser/pinned-posts',
            {'post_url': 'test-post-0'}
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_add_pinned_post_own_posts_only(self):
        """본인의 글만 고정 가능"""
        self.client.login(username='otheruser', password='testpass')

        response = self.client.post(
            '/v1/users/@testuser/pinned-posts',
            {'post_url': 'test-post-0'}
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:AT')

    def test_add_pinned_post_max_limit(self):
        """최대 6개 고정 제한"""
        self.client.login(username='testuser', password='testpass')

        # Pin 6 posts
        for i in range(6):
            PinnedPost.objects.create(user=self.user, post=self.posts[i], order=i)

        # Try to pin a 7th post
        response = self.client.post(
            '/v1/users/@testuser/pinned-posts',
            {'post_url': 'test-post-6'}
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertIn('6개', content['errorMessage'])

    def test_add_pinned_post_already_pinned(self):
        """이미 고정된 글 다시 고정 시도"""
        self.client.login(username='testuser', password='testpass')
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)

        response = self.client.post(
            '/v1/users/@testuser/pinned-posts',
            {'post_url': 'test-post-0'}
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertIn('이미 고정', content['errorMessage'])

    def test_add_pinned_post_hidden_post(self):
        """숨김 글은 고정 불가"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post(
            '/v1/users/@testuser/pinned-posts',
            {'post_url': 'hidden-post'}
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertIn('숨김', content['errorMessage'])

    def test_add_pinned_post_nonexistent_post(self):
        """존재하지 않는 글 고정 시도"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post(
            '/v1/users/@testuser/pinned-posts',
            {'post_url': 'nonexistent-post'}
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertIn('찾을 수 없', content['errorMessage'])

    def test_add_pinned_post_missing_url(self):
        """글 URL 누락"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post('/v1/users/@testuser/pinned-posts', {})
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:IP')

    # DELETE /v1/users/@<username>/pinned-posts
    def test_remove_pinned_post_success(self):
        """고정 글 삭제 성공"""
        self.client.login(username='testuser', password='testpass')
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)

        response = self.client.delete(
            '/v1/users/@testuser/pinned-posts',
            data='post_url=test-post-0',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # Verify pinned post was deleted
        self.assertFalse(PinnedPost.objects.filter(user=self.user, post=self.posts[0]).exists())

    def test_remove_pinned_post_reorders(self):
        """고정 글 삭제 후 순서 재정렬"""
        self.client.login(username='testuser', password='testpass')
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)
        PinnedPost.objects.create(user=self.user, post=self.posts[1], order=1)
        PinnedPost.objects.create(user=self.user, post=self.posts[2], order=2)

        # Remove middle post
        response = self.client.delete(
            '/v1/users/@testuser/pinned-posts',
            data='post_url=test-post-1',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)

        # Check order is updated
        remaining = PinnedPost.objects.filter(user=self.user).order_by('order')
        self.assertEqual(remaining.count(), 2)
        self.assertEqual(remaining[0].post.url, 'test-post-0')
        self.assertEqual(remaining[0].order, 0)
        self.assertEqual(remaining[1].post.url, 'test-post-2')
        self.assertEqual(remaining[1].order, 1)

    def test_remove_pinned_post_not_pinned(self):
        """고정되지 않은 글 삭제 시도"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.delete(
            '/v1/users/@testuser/pinned-posts',
            data='post_url=test-post-0',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertIn('찾을 수 없', content['errorMessage'])

    def test_remove_pinned_post_requires_login(self):
        """고정 글 삭제는 로그인 필요"""
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)

        response = self.client.delete(
            '/v1/users/@testuser/pinned-posts',
            data='post_url=test-post-0',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    # PUT /v1/users/@<username>/pinned-posts/order
    def test_reorder_pinned_posts_success(self):
        """고정 글 순서 변경 성공"""
        self.client.login(username='testuser', password='testpass')
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)
        PinnedPost.objects.create(user=self.user, post=self.posts[1], order=1)
        PinnedPost.objects.create(user=self.user, post=self.posts[2], order=2)

        # Reverse order
        new_order = ['test-post-2', 'test-post-1', 'test-post-0']
        response = self.client.put(
            '/v1/users/@testuser/pinned-posts/order',
            data=f'post_urls={json.dumps(new_order)}',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # Verify order
        pinned = PinnedPost.objects.filter(user=self.user).order_by('order')
        self.assertEqual(pinned[0].post.url, 'test-post-2')
        self.assertEqual(pinned[1].post.url, 'test-post-1')
        self.assertEqual(pinned[2].post.url, 'test-post-0')

    def test_reorder_pinned_posts_requires_login(self):
        """순서 변경은 로그인 필요"""
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)

        response = self.client.put(
            '/v1/users/@testuser/pinned-posts/order',
            data='post_urls=[]',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_reorder_pinned_posts_invalid_url(self):
        """순서 변경 시 존재하지 않는 URL"""
        self.client.login(username='testuser', password='testpass')
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)

        response = self.client.put(
            '/v1/users/@testuser/pinned-posts/order',
            data='post_urls=["test-post-0", "nonexistent"]',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertIn('고정되지 않은', content['errorMessage'])

    def test_reorder_pinned_posts_invalid_json(self):
        """순서 변경 시 잘못된 JSON 형식"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.put(
            '/v1/users/@testuser/pinned-posts/order',
            data='post_urls=invalid-json',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:IP')

    # GET /v1/users/@<username>/pinnable-posts
    def test_get_pinnable_posts_success(self):
        """고정 가능한 글 목록 조회"""
        self.client.login(username='testuser', password='testpass')
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)

        response = self.client.get('/v1/users/@testuser/pinnable-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        # Should return posts that are not pinned and not hidden
        urls = [p['url'] for p in content['body']['posts']]
        self.assertNotIn('test-post-0', urls)  # Already pinned
        self.assertNotIn('hidden-post', urls)  # Hidden
        self.assertIn('test-post-1', urls)

    def test_get_pinnable_posts_requires_login(self):
        """고정 가능한 글 목록은 로그인 필요"""
        response = self.client.get('/v1/users/@testuser/pinnable-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_pinnable_posts_own_only(self):
        """본인의 고정 가능한 글만 조회"""
        self.client.login(username='otheruser', password='testpass')

        response = self.client.get('/v1/users/@testuser/pinnable-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:AT')

    # Edge cases
    def test_pinned_post_order_auto_increment(self):
        """고정 글 추가 시 순서 자동 증가"""
        self.client.login(username='testuser', password='testpass')

        # Add posts one by one
        self.client.post('/v1/users/@testuser/pinned-posts', {'post_url': 'test-post-0'})
        self.client.post('/v1/users/@testuser/pinned-posts', {'post_url': 'test-post-1'})
        self.client.post('/v1/users/@testuser/pinned-posts', {'post_url': 'test-post-2'})

        pinned = PinnedPost.objects.filter(user=self.user).order_by('order')
        self.assertEqual(pinned[0].order, 0)
        self.assertEqual(pinned[1].order, 1)
        self.assertEqual(pinned[2].order, 2)

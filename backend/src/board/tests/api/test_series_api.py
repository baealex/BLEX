import json

from django.test import TestCase
from django.utils import timezone

from board.models import (
    User, Config, Post, PostContent, PostConfig,
    Profile, Series
)


class SeriesAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create author user
        author = User.objects.create_user(
            username='author',
            password='author',
            email='author@test.com',
            first_name='Author User',
        )
        Profile.objects.create(user=author, role=Profile.Role.EDITOR)
        Config.objects.create(user=author)

        # Create viewer user
        viewer = User.objects.create_user(
            username='viewer',
            password='viewer',
            email='viewer@test.com',
            first_name='Viewer User',
        )
        Profile.objects.create(user=viewer, role=Profile.Role.READER)
        Config.objects.create(user=viewer)

        # Create test posts
        for i in range(10):
            post = Post.objects.create(
                url=f'test-post-{i}',
                title=f'Test Post {i}',
                author=author,
                published_date=timezone.now(),
            )
            PostContent.objects.create(
                post=post,
                text_md=f'# Test Post {i}',
                text_html=f'<h1>Test Post {i}</h1>'
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )

        # Create a test series
        cls.test_series = Series.objects.create(
            owner=author,
            name='Test Series',
            url='test-series',
            text_md='Test series description',
            text_html='<p>Test series description</p>',
        )
        # Add some posts to series
        post1 = Post.objects.get(url='test-post-1')
        post2 = Post.objects.get(url='test-post-2')
        cls.test_series.posts.add(post1, post2)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    # GET /v1/series - Get user's series list
    def test_get_user_series_list(self):
        """사용자의 시리즈 목록 조회 테스트"""
        self.client.login(username='author', password='author')
        response = self.client.get('/v1/series')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIn('series', content['body'])
        self.assertGreater(len(content['body']['series']), 0)

    def test_get_series_list_requires_login(self):
        """시리즈 목록 조회는 로그인이 필요함"""
        response = self.client.get('/v1/series')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    # POST /v1/series - Create new series
    def test_create_series(self):
        """시리즈 생성 테스트"""
        self.client.login(username='author', password='author')
        data = {
            'name': 'New Series',
            'url': 'new-series',
            'description': 'New Series Description'
        }
        response = self.client.post(
            '/v1/series',
            data=json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['name'], 'New Series')
        self.assertTrue(Series.objects.filter(name='New Series').exists())

    def test_create_series_without_url(self):
        """URL 없이 시리즈 생성 시 자동 URL 생성 테스트"""
        self.client.login(username='author', password='author')
        data = {
            'name': 'Series Without URL',
            'description': 'Description'
        }
        response = self.client.post(
            '/v1/series',
            data=json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIsNotNone(content['body']['url'])

    def test_create_series_requires_login(self):
        """시리즈 생성은 로그인이 필요함"""
        data = {'name': 'Test', 'description': 'Test'}
        response = self.client.post(
            '/v1/series',
            data=json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_create_series_without_name(self):
        """이름 없이 시리즈 생성 시 에러 발생"""
        self.client.login(username='author', password='author')
        data = {
            'description': 'Test description'
        }
        response = self.client.post(
            '/v1/series',
            data=json.dumps(data),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertNotEqual(content['status'], 'DONE')

    # PUT /v1/series/<id> - Update series
    def test_update_series(self):
        """시리즈 수정 테스트"""
        self.client.login(username='author', password='author')
        series = Series.objects.get(url='test-series')
        data = {
            'name': 'Updated Series Name',
            'description': 'Updated Description'
        }
        response = self.client.put(
            f'/v1/series/{series.id}',
            data=json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        series.refresh_from_db()
        self.assertEqual(series.name, 'Updated Series Name')

    def test_update_series_requires_ownership(self):
        """다른 사용자의 시리즈는 수정할 수 없음"""
        self.client.login(username='viewer', password='viewer')
        series = Series.objects.get(url='test-series')
        data = {'name': 'Hacked Name'}
        response = self.client.put(
            f'/v1/series/{series.id}',
            data=json.dumps(data),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertNotEqual(content['status'], 'DONE')

    # DELETE /v1/series/<id> - Delete series
    def test_delete_series(self):
        """시리즈 삭제 테스트"""
        self.client.login(username='author', password='author')
        # Create a new series to delete
        series = Series.objects.create(
            owner=User.objects.get(username='author'),
            name='Series to Delete',
            url='series-to-delete'
        )
        response = self.client.delete(f'/v1/series/{series.id}')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Series.objects.filter(id=series.id).exists())

    def test_delete_series_requires_ownership(self):
        """다른 사용자의 시리즈는 삭제할 수 없음"""
        self.client.login(username='viewer', password='viewer')
        series = Series.objects.get(url='test-series')
        response = self.client.delete(f'/v1/series/{series.id}')
        content = json.loads(response.content)
        self.assertNotEqual(content['status'], 'DONE')
        self.assertTrue(Series.objects.filter(id=series.id).exists())

    # GET /v1/series/valid-posts - Get posts available for series
    def test_get_valid_posts_for_series(self):
        """시리즈에 추가 가능한 포스트 조회 테스트"""
        self.client.login(username='author', password='author')
        response = self.client.get('/v1/series/valid-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIn('body', content)
        self.assertIsInstance(content['body'], list)

    def test_get_valid_posts_requires_login(self):
        """시리즈 추가 가능 포스트 조회는 로그인이 필요함"""
        response = self.client.get('/v1/series/valid-posts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    # PUT /v1/series/order - Update series order
    def test_update_series_order(self):
        """시리즈 순서 변경 테스트"""
        self.client.login(username='author', password='author')

        # Create another series
        series2 = Series.objects.create(
            owner=User.objects.get(username='author'),
            name='Second Series',
            url='second-series'
        )

        series1 = Series.objects.get(url='test-series')

        data = {
            'order': [[series1.id, 2], [series2.id, 1]]
        }
        response = self.client.put(
            '/v1/series/order',
            data=json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

    # GET /v1/users/@<username>/series - Get public series list
    def test_get_user_public_series_list(self):
        """사용자의 공개 시리즈 목록 조회 테스트"""
        response = self.client.get('/v1/users/@author/series')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIn('series', content['body'])

    def test_get_user_public_series_list_with_pagination(self):
        """페이지네이션이 적용된 시리즈 목록 조회"""
        response = self.client.get('/v1/users/@author/series?page=1')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIn('lastPage', content['body'])

    # GET /v1/users/@<username>/series/<url> - Get series detail
    def test_get_series_detail(self):
        """시리즈 상세 조회 테스트"""
        response = self.client.get('/v1/users/@author/series/test-series')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['name'], 'Test Series')
        self.assertIn('posts', content['body'])

    def test_get_series_detail_with_order_param(self):
        """정렬 옵션을 포함한 시리즈 상세 조회"""
        response = self.client.get('/v1/users/@author/series/test-series?order=oldest')
        self.assertEqual(response.status_code, 200)

    def test_get_series_detail_continue_reading(self):
        """이어 읽기 정보 조회 테스트"""
        response = self.client.get('/v1/users/@author/series/test-series?kind=continue')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIn('posts', content['body'])

    def test_get_nonexistent_series(self):
        """존재하지 않는 시리즈 조회 시 404 에러"""
        response = self.client.get('/v1/users/@author/series/nonexistent-series')
        self.assertEqual(response.status_code, 404)

    # PUT /v1/users/@<username>/series/<url> - Update series via user endpoint
    def test_update_series_via_user_endpoint(self):
        """사용자 엔드포인트를 통한 시리즈 수정"""
        self.client.login(username='author', password='author')
        post3 = Post.objects.get(url='test-post-3')
        post4 = Post.objects.get(url='test-post-4')

        data = {
            'title': 'Updated Title',
            'description': 'Updated Description',
            'post_ids': [post3.id, post4.id]
        }
        response = self.client.put(
            '/v1/users/@author/series/test-series',
            data=json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

    # DELETE /v1/users/@<username>/series/<url> - Delete series via user endpoint
    def test_delete_series_via_user_endpoint(self):
        """사용자 엔드포인트를 통한 시리즈 삭제"""
        self.client.login(username='author', password='author')

        # Create a series to delete
        series = Series.objects.create(
            owner=User.objects.get(username='author'),
            name='Series to Delete 2',
            url='series-to-delete-2'
        )

        response = self.client.delete(f'/v1/users/@author/series/series-to-delete-2')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Series.objects.filter(url='series-to-delete-2').exists())

    # POST /v1/users/@<username>/series - Create series with posts
    def test_create_series_with_posts(self):
        """포스트를 포함한 시리즈 생성"""
        self.client.login(username='author', password='author')
        post5 = Post.objects.get(url='test-post-5')
        post6 = Post.objects.get(url='test-post-6')

        data = {
            'title': 'Series with Posts',
            'description': 'Description',
            'post_ids': f'{post5.id},{post6.id}'
        }
        response = self.client.post(
            '/v1/users/@author/series',
            data=json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        # Verify series was created with posts
        if 'body' in content:
            series = Series.objects.get(url=content['body']['url'])
            self.assertEqual(series.posts.count(), 2)
        else:
            self.fail(f"Failed to create series: {content}")

    def test_series_with_hidden_posts_integration(self):
        """숨김 포스트가 포함된 시리즈의 통합 동작 테스트 (API & Thumbnail)"""
        self.client.login(username='author', password='author')
        
        # 1. 썸네일 테스트를 위한 숨김 포스트 전용 시리즈 생성
        hidden_series = Series.objects.create(
            owner=User.objects.get(username='author'),
            name='Hidden Series',
            url='hidden-series'
        )
        post = Post.objects.create(author=User.objects.get(username='author'), title='Hidden Post', url='hidden-post', published_date=timezone.now())
        PostConfig.objects.create(post=post, hide=True)
        post.series = hidden_series
        post.save()

        # 2. Owner API 조회 - 시리즈가 존재해야 하며, thumbnail() 에러가 없어야 함
        # get_user_series_list 사용
        response = self.client.get('/v1/series')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        
        series_data = next((s for s in content['body']['series'] if s['url'] == 'hidden-series'), None)
        self.assertIsNotNone(series_data)
        self.assertEqual(series_data['totalPosts'], 0) # 숨김 포스트는 카운트 제외
        
        # 썸네일 생성 로직이 API 응답 구성 시 호출되므로, 
        # 위 API 호출이 성공했다면 Series.thumbnail()의 IndexError 수정도 검증된 것임.

        # 3. Public API 조회 - 숨김 포스트만 있는 시리즈는 목록에서 제외되어야 함
        response = self.client.get('/v1/users/@author/series')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        
        series_urls = [s['url'] for s in content['body']['series']]
        self.assertNotIn('hidden-series', series_urls)





import json
import datetime
from io import BytesIO

from PIL import Image

from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from board.models import (
    User, Config, Post, PostContent, PostConfig, Profile, Series
)


class PostTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        author = User.objects.create_user(
            username='author',
            password='author',
            email='author@author.com',
            first_name='Author User',
        )
        Profile.objects.create(user=author, role=Profile.Role.EDITOR)
        Config.objects.create(user=author)

        viewer = User.objects.create_user(
            username='viewer',
            password='viewer',
            email='viewer@author.com',
            first_name='Viewer User',
        )
        Profile.objects.create(user=viewer, role=Profile.Role.READER)
        Config.objects.create(user=viewer)

        number_of_posts = 100

        for post_num in range(number_of_posts):
            post = Post.objects.create(
                url=f'test-post-{post_num}',
                title=f'Test Post {post_num}',
                author=author,
                published_date=timezone.now(),
            )
            PostContent.objects.create(
                post=post,
                text_md=f'# Test Post {post_num}',
                text_html=f'<h1>Test Post {post_num}</h1>'
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )
    
    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'


    def test_get_user_post_detail(self):
        """포스트 상세 조회 테스트"""
        params = {'mode': 'view'}
        response = self.client.get('/v1/users/@author/posts/test-post-1', params)
        self.assertEqual(response.status_code, 200)

    def test_no_access_other_user_post_edit_mode(self):
        """다른 사용자의 포스트 편집 모드 접근 차단 테스트"""
        params = {'mode': 'edit'}
        response = self.client.get('/v1/users/@author/posts/test-post-1', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode(self):
        """포스트 편집 모드 조회 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get('/v1/users/@author/posts/test-post-1', params)
        self.assertEqual(response.status_code, 200)

    def test_update_user_post(self):
        """포스트 수정 테스트"""
        self.client.login(username='author', password='author')

        post = Post.objects.get(url='test-post-1')
        response = self.client.post('/v1/users/@author/posts/test-post-1', {
            'title': f'{post.title} Updated',
            'text_html': post.content.text_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
        })

        post.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.title, 'Test Post 1 Updated')

    def test_get_user_post_detail_edit_mode_with_not_exist_post(self):
        """존재하지 않는 포스트 편집 모드 접근 시 404 에러 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@author/posts/not-exist-post', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode_with_not_exist_user(self):
        """존재하지 않는 사용자의 포스트 편집 모드 접근 시 404 에러 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@not-exist-user/posts/test-post-1', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode_with_not_match_user(self):
        """작성자가 일치하지 않는 포스트 편집 모드 접근 시 404 에러 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@not-test-user/posts/test-post-1', params)
        self.assertEqual(response.status_code, 404)

    def test_create_post_duplicate_url(self):
        """중복된 URL로 포스트 생성 시 자동 URL 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['url']),
                         len('test-post-1-00000000'))

    def test_create_post_custom_url(self):
        """커스텀 URL로 포스트 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'url': 'custom-url'
        })
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['url'], 'custom-url')

    def test_create_post(self):
        """포스트 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1000',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['url'], 'test-post-1000')

    def test_create_post_with_not_logged_in_user(self):
        """비로그인 사용자의 포스트 생성 차단 테스트"""
        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })

        self.assertEqual(response.status_code, 404)

    def test_create_post_empty_title(self):
        """빈 제목으로 포스트 생성 시 에러 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': '',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    def test_create_post_empty_text(self):
        """빈 내용으로 포스트 생성 시 에러 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    def test_create_post_reserved(self):
        """예약 포스트 생성 및 공개 제한 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Reserved Post',
            'text_html': '# Test Reserved Post',
            'is_hide': False,
            'is_advertise': False,
            'reserved_date': f"{(datetime.date.today() + datetime.timedelta(days=1)).strftime('%Y-%m-%d')}T12:00:00.000Z"
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['url'], 'test-reserved-post')

        params = {'mode': 'view'}
        response = self.client.get(
            '/v1/users/@author/posts/test-reserved-post', params)
        self.assertEqual(response.status_code, 200)

        self.client.logout()
        response = self.client.get(
            '/v1/users/@author/posts/test-reserved-post', params)
        self.assertEqual(response.status_code, 404)
    
    def test_create_post_reserved_before(self):
        """과거 날짜로 예약 포스트 생성 시 에러 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Reserved Post',
            'text_html': '# Test Reserved Post',
            'is_hide': False,
            'is_advertise': False,
            'reserved_date': f"{(datetime.date.today() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')}T12:00:00.000Z"
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    def test_create_post_custom_description(self):
        """커스텀 설명을 포함한 포스트 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'description': 'Custom Description'
        })
        content = json.loads(response.content)
        post = Post.objects.get(url=content['body']['url'])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.meta_description, 'Custom Description')
    
    def test_create_post_without_invitation(self):
        """초대받지 않은 사용자의 포스트 생성 차단 테스트"""
        self.client.login(username='viewer', password='viewer')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'description': 'Custom Description'
        })
        content = json.loads(response.content)
        self.assertEqual(content['errorCode'], 'error:VA')

    def _create_test_image(self, name='test.jpg', size=(100, 100), color='red'):
        """테스트용 이미지 파일 생성 헬퍼 메소드"""
        file = BytesIO()
        image = Image.new('RGB', size, color)
        image.save(file, 'JPEG')
        file.seek(0)
        return SimpleUploadedFile(
            name,
            file.read(),
            content_type='image/jpeg'
        )

    def test_update_post_add_image(self):
        """이미지가 없는 포스트에 이미지 추가 테스트"""
        self.client.login(username='author', password='author')

        post = Post.objects.get(url='test-post-1')
        # 초기 상태 확인: 이미지가 없음
        self.assertFalse(post.image)

        # 이미지와 함께 포스트 업데이트
        image = self._create_test_image('new_image.jpg')
        response = self.client.post('/v1/users/@author/posts/test-post-1', {
            'title': post.title,
            'text_html': post.content.text_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            'image': image,
        })

        # 응답 확인
        self.assertEqual(response.status_code, 200)

        # 데이터베이스에서 다시 가져와서 확인
        post.refresh_from_db()
        self.assertTrue(post.image)
        # 파일명은 title_image_path 함수에 의해 자동 생성되므로 경로만 확인
        self.assertIn('images/title/', post.image.name)
        self.assertIn('/author/', post.image.name)

    def test_update_post_change_image(self):
        """기존 이미지를 새 이미지로 변경 테스트"""
        self.client.login(username='author', password='author')

        # 먼저 이미지가 있는 포스트 생성
        post = Post.objects.get(url='test-post-2')
        old_image = self._create_test_image('old_image.jpg', color='blue')
        post.image = old_image
        post.save()
        old_image_name = post.image.name

        # 새 이미지로 변경
        new_image = self._create_test_image('new_image.jpg', color='red')
        response = self.client.post('/v1/users/@author/posts/test-post-2', {
            'title': post.title,
            'text_html': post.content.text_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            'image': new_image,
        })

        # 응답 확인
        self.assertEqual(response.status_code, 200)

        # 데이터베이스에서 다시 가져와서 확인
        post.refresh_from_db()
        self.assertTrue(post.image)
        # 파일명은 title_image_path 함수에 의해 자동 생성되므로 경로만 확인
        self.assertIn('images/title/', post.image.name)
        self.assertIn('/author/', post.image.name)
        self.assertNotEqual(post.image.name, old_image_name)

    def test_update_post_delete_image(self):
        """포스트의 이미지 삭제 테스트"""
        self.client.login(username='author', password='author')

        # 먼저 이미지가 있는 포스트 생성
        post = Post.objects.get(url='test-post-3')
        image = self._create_test_image('to_delete.jpg')
        post.image = image
        post.save()

        # 이미지가 있는지 확인
        self.assertTrue(post.image)

        # image_delete 플래그와 함께 업데이트
        response = self.client.post('/v1/users/@author/posts/test-post-3', {
            'title': post.title,
            'text_html': post.content.text_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            'image_delete': 'true',
        })

        # 응답 확인
        self.assertEqual(response.status_code, 200)

        # 데이터베이스에서 다시 가져와서 확인
        post.refresh_from_db()
        self.assertFalse(post.image)

    def test_update_post_keep_existing_image(self):
        """기존 이미지를 유지하는 테스트 (이미지 필드를 건드리지 않음)"""
        self.client.login(username='author', password='author')

        # 먼저 이미지가 있는 포스트 생성
        post = Post.objects.get(url='test-post-4')
        image = self._create_test_image('keep_image.jpg')
        post.image = image
        post.save()
        original_image_name = post.image.name

        # 이미지 필드 없이 다른 필드만 업데이트
        response = self.client.post('/v1/users/@author/posts/test-post-4', {
            'title': post.title + ' Updated',
            'text_html': post.content.text_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            # image 필드 없음 - 기존 이미지 유지되어야 함
        })

        # 응답 확인
        self.assertEqual(response.status_code, 200)

        # 데이터베이스에서 다시 가져와서 확인
        post.refresh_from_db()
        self.assertTrue(post.image)
        self.assertEqual(post.image.name, original_image_name)
        self.assertEqual(post.title, 'Test Post 4 Updated')

    def test_post_detail_hidden_in_series(self):
        """시리즈에 포함된 숨김 포스트 조회 시 에러 없이 안내 문구 표시 테스트"""
        self.client.login(username='author', password='author')
        
        # 시리즈 생성
        author = User.objects.get(username='author')
        series = Series.objects.create(owner=author, name='Test Series', url='test-series')
        
        # 기존 포스트를 시리즈에 연결
        post = Post.objects.get(url='test-post-1')
        post.series = series
        post.save()
        
        # 포스트 숨김 처리
        post.config.hide = True
        post.config.save()
        
        # 뷰 페이지 조회 (템플릿 뷰)
        response = self.client.get('/@author/test-post-1')
        self.assertEqual(response.status_code, 200)
        # 안내 문구 확인
        self.assertContains(response, '이 포스트는 숨김 처리되어 시리즈 목록에 표시되지 않습니다.')

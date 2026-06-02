import json

from django.core.cache import cache
from django.test import TestCase
from django.test.client import Client
from django.utils import timezone

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    Comment, Config, Notify, Post, PostConfig, PostContent,
    PostLikes, Profile, User, UserLinkMeta
)


class SettingTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
            first_name='Test User',
        )

        Config.objects.create(
            user=User.objects.get(username='test'),
        )

        Profile.objects.create(
            user=User.objects.get(username='test'),
            role=Profile.Role.EDITOR
        )

        for i in range(2):
            Notify.objects.create(
                user=User.objects.get(username='test'),
                content=f'test notify {i}',
                url=f'/test-url-{i}',
                key=f'test-key-{i}',
            )

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        cache.clear()

    def test_get_setting_notify_not_login(self):
        """비로그인 상태에서 알림 설정 조회 시 에러 테스트"""
        response = self.client.get('/v1/setting/notify')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_setting_notify(self):
        """알림 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/notify')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['notify']), 2)
        self.assertEqual(content['body']['isTelegramSync'], False)

    def test_update_setting_notify_marks_as_read(self):
        """알림 읽음 처리 테스트"""
        notify = Notify.objects.filter(user__username='test').first()
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify',
            json.dumps({'id': notify.id}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        notify.refresh_from_db()
        self.assertTrue(notify.has_read)

    def test_update_setting_notify_rejects_other_user_notification(self):
        """다른 사용자의 알림 읽음 처리를 막는다."""
        other_user = User.objects.create_user(
            username='notify-owner',
            password='test',
            email='notify-owner@test.com',
        )
        Config.objects.create(user=other_user)
        Profile.objects.create(user=other_user, role=Profile.Role.READER)
        notify = Notify.objects.create(
            user=other_user,
            content='other notify',
            url='/other-notify',
            key='other-notify-key',
        )
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify',
            json.dumps({'id': notify.id}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NF')
        notify.refresh_from_db()
        self.assertFalse(notify.has_read)
    
    def test_get_setting_notify_config(self):
        """알림 설정 구성 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/notify-config')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(type(content['body']['config']), list)
        self.assertEqual(len(content['body']['config']), 4)
        self.assertEqual(
            {item['name'] for item in content['body']['config']},
            {
                CONFIG_TYPE.NOTIFY_POSTS_LIKE.value,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value,
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value,
                CONFIG_TYPE.NOTIFY_MENTION.value,
            }
        )

    def test_get_setting_notify_config_reader(self):
        """독자(READER)는 기본 알림 설정 2개만 조회 테스트"""
        reader = User.objects.create_user(
            username='reader',
            password='test',
            email='reader@test.com',
            first_name='Reader User',
        )
        Config.objects.create(user=reader)
        Profile.objects.create(user=reader, role=Profile.Role.READER)

        self.client.login(username='reader', password='test')

        response = self.client.get('/v1/setting/notify-config')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        self.assertEqual(len(content['body']['config']), 2)
        self.assertEqual(
            {item['name'] for item in content['body']['config']},
            {
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value,
                CONFIG_TYPE.NOTIFY_MENTION.value,
            }
        )

    def test_get_setting_heatmap_counts_private_user_activity_and_uses_cache(self):
        """설정 heatmap은 기존 private activity 집계와 1시간 캐시 정책을 유지한다."""
        user = User.objects.get(username='test')
        post = Post.objects.create(
            url='heatmap-post',
            title='Heatmap Post',
            author=user,
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=post,
            content_html='<h1>Heatmap</h1>'
        )
        PostConfig.objects.create(
            post=post,
            hide=True,
        )
        Comment.objects.create(
            post=post,
            author=user,
            text_md='Heatmap comment',
            text_html='<p>Heatmap comment</p>',
        )
        PostLikes.objects.create(post=post, user=user)
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/heatmap')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(sum(content['body'].values()), 3)

        PostLikes.objects.create(post=post, user=user)
        cached_response = self.client.get('/v1/setting/heatmap')
        cached_content = json.loads(cached_response.content)

        self.assertEqual(sum(cached_content['body'].values()), 3)

    def test_get_setting_reserved_posts_returns_management_fields(self):
        """예약 포스트 설정 목록은 포스트 관리 카드에 필요한 필드를 내려준다."""
        user = User.objects.get(username='test')
        scheduled_post = Post.objects.create(
            url='scheduled-post',
            title='Scheduled Post',
            author=user,
            image='images/title/test/scheduled-post.png',
            published_date=timezone.now() + timezone.timedelta(days=1),
        )
        PostContent.objects.create(
            post=scheduled_post,
            content_html='<h1>Scheduled Post</h1>'
        )
        PostConfig.objects.create(
            post=scheduled_post,
            hide=False,
        )
        published_post = Post.objects.create(
            url='published-post',
            title='Published Post',
            author=user,
            published_date=timezone.now() - timezone.timedelta(days=1),
        )
        PostContent.objects.create(
            post=published_post,
            content_html='<h1>Published Post</h1>'
        )
        PostConfig.objects.create(
            post=published_post,
            hide=False,
        )
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/reserved-posts')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        post_urls = [item['url'] for item in content['body']['posts']]
        self.assertEqual(post_urls, ['scheduled-post'])
        scheduled_data = content['body']['posts'][0]
        self.assertEqual(scheduled_data['image'], 'images/title/test/scheduled-post.png')
        self.assertEqual(scheduled_data['isHide'], False)
        self.assertIn('updatedDate', scheduled_data)
        self.assertIn('readTime', scheduled_data)
        self.assertIn('countLikes', scheduled_data)
        self.assertIn('countComments', scheduled_data)
        self.assertIn('tag', scheduled_data)
        self.assertIn('series', scheduled_data)

    def test_get_setting_reserved_posts_returns_empty_page(self):
        """예약 포스트가 없어도 첫 페이지는 빈 목록으로 응답한다."""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/reserved-posts')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['posts'], [])
        self.assertEqual(content['body']['lastPage'], 1)

    def test_get_setting_reserved_posts_orders_by_count_fields(self):
        """예약 포스트 설정 목록은 좋아요/댓글 수 정렬을 지원한다."""
        user = User.objects.get(username='test')
        liker = User.objects.create_user(
            username='setting-liker',
            password='test',
            email='setting-liker@test.com',
        )
        Config.objects.create(user=liker)
        Profile.objects.create(user=liker, role=Profile.Role.READER)

        quiet_post = Post.objects.create(
            url='quiet-scheduled-post',
            title='Quiet Scheduled Post',
            author=user,
            published_date=timezone.now() + timezone.timedelta(days=1),
        )
        PostContent.objects.create(post=quiet_post, content_html='<p>Quiet</p>')
        PostConfig.objects.create(post=quiet_post, hide=False)

        active_post = Post.objects.create(
            url='active-scheduled-post',
            title='Active Scheduled Post',
            author=user,
            published_date=timezone.now() + timezone.timedelta(days=2),
        )
        PostContent.objects.create(post=active_post, content_html='<p>Active</p>')
        PostConfig.objects.create(post=active_post, hide=False)
        PostLikes.objects.create(post=active_post, user=liker)
        Comment.objects.create(
            post=active_post,
            author=liker,
            text_md='Scheduled comment',
            text_html='<p>Scheduled comment</p>',
        )
        self.client.login(username='test', password='test')

        likes_response = self.client.get('/v1/setting/reserved-posts', {
            'order': '-count_likes',
        })
        comments_response = self.client.get('/v1/setting/reserved-posts', {
            'order': '-count_comments',
        })

        self.assertEqual(likes_response.status_code, 200)
        self.assertEqual(comments_response.status_code, 200)
        likes_content = json.loads(likes_response.content)
        comments_content = json.loads(comments_response.content)
        self.assertEqual(likes_content['body']['posts'][0]['url'], 'active-scheduled-post')
        self.assertEqual(comments_content['body']['posts'][0]['url'], 'active-scheduled-post')

    def test_update_notify_config_without_posts(self):
        """포스트가 없는 사용자의 알림 설정 업데이트 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify-config',
            json.dumps({
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value: 'true',
                CONFIG_TYPE.NOTIFY_MENTION.value: 'false',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        user = User.objects.get(username='test')
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE), True)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), False)

    def test_update_notify_config_with_posts(self):
        """포스트가 있는 사용자의 알림 설정 업데이트 테스트"""
        user = User.objects.get(username='test')
        
        post = Post.objects.create(
            url='test-post',
            title='Test Post',
            author=user,
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=post,
            content_html='<h1>Test</h1>'
        )
        PostConfig.objects.create(
            post=post,
            hide=False,
        )

        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify-config',
            json.dumps({
                CONFIG_TYPE.NOTIFY_POSTS_LIKE.value: 'true',
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value: 'true',
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value: 'false',
                CONFIG_TYPE.NOTIFY_MENTION.value: 'true',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        user.refresh_from_db()
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE), True)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT), True)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE), False)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), True)
    
    def test_get_setting_account(self):
        """계정 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/account')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['username'], 'test')
        self.assertEqual(content['body']['name'], 'Test User')

    def test_update_username(self):
        """사용자 필명 변경 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/account',
            'username=newtest',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        user = User.objects.get(id=User.objects.get(username='newtest').id)
        self.assertEqual(user.username, 'newtest')

    def test_update_username_duplicate(self):
        """중복된 사용자 필명 변경 테스트"""
        User.objects.create_user(
            username='duplicate',
            password='test',
            email='duplicate@test.com',
            first_name='Duplicate User',
        )

        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/account',
            'username=duplicate',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorMessage'], '이미 사용중인 아이디입니다.')

    def test_upload_avatar(self):
        """프로필 이미지 업로드 테스트"""
        from io import BytesIO
        from PIL import Image

        self.client.login(username='test', password='test')

        image = Image.new('RGB', (100, 100), color='red')
        image_file = BytesIO()
        image.save(image_file, 'PNG')
        image_file.name = 'test.png'
        image_file.seek(0)

        response = self.client.post(
            '/v1/setting/avatar',
            {'avatar': image_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('url', content['body'])

    def test_upload_cover(self):
        """커버 이미지 업로드 테스트"""
        from io import BytesIO
        from PIL import Image

        self.client.login(username='test', password='test')

        image = Image.new('RGB', (1200, 514), color='blue')
        image_file = BytesIO()
        image.save(image_file, 'PNG')
        image_file.name = 'cover.png'
        image_file.seek(0)

        response = self.client.post(
            '/v1/setting/cover',
            {'cover': image_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('url', content['body'])

    def test_delete_cover(self):
        """커버 이미지 삭제 테스트"""
        user = User.objects.get(username='test')
        profile = Profile.objects.get(user=user)
        profile.cover = 'images/avatar/test/cover.png'
        profile.save(update_fields=['cover'])

        self.client.login(username='test', password='test')

        response = self.client.delete('/v1/setting/cover')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIsNone(content['body']['url'])

        profile.refresh_from_db()
        self.assertFalse(profile.cover)

    def test_get_setting_profile(self):
        """프로필 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/profile')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('avatar', content['body'])
        self.assertIn('cover', content['body'])
        self.assertIn('bio', content['body'])
        self.assertIn('homepage', content['body'])

    def test_update_profile(self):
        """프로필 설정 업데이트 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/profile',
            'bio=Test bio&homepage=https://example.com',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        profile = Profile.objects.get(user=User.objects.get(username='test'))
        self.assertEqual(profile.bio, 'Test bio')
        self.assertEqual(profile.homepage, 'https://example.com')

    def test_update_social_links(self):
        """소셜 링크 생성/수정/삭제 테스트"""
        user = User.objects.get(username='test')
        update_link = UserLinkMeta.objects.create(
            user=user,
            name='github',
            value='https://github.com/old',
            order=1,
        )
        delete_link = UserLinkMeta.objects.create(
            user=user,
            name='old',
            value='https://old.example.com',
            order=2,
        )
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/social',
            json.dumps({
                'update': f'{update_link.id},github,https://github.com/new,3',
                'create': 'homepage,https://example.com,4',
                'delete': str(delete_link.id),
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        update_link.refresh_from_db()
        self.assertEqual(update_link.value, 'https://github.com/new')
        self.assertFalse(UserLinkMeta.objects.filter(id=delete_link.id).exists())
        self.assertEqual(
            [item['name'] for item in content['body']],
            ['github', 'homepage'],
        )

    def test_update_account_not_logged_in(self):
        """비로그인 상태에서 계정 수정 시도"""
        response = self.client.put(
            '/v1/setting/account',
            'username=hacked',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

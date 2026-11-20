"""
작가 구독 API와 새 글 알림 테스트
"""
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from board.models import (
    AuthorSubscription,
    AuthorSubscriptionLog,
    IntegrationSetting,
    Notify,
    Post,
    PostConfig,
    PostContent,
    Profile,
    TelegramSync,
)
from board.services.author_subscription_service import AuthorSubscriptionService
from board.services.integration_setting_service import IntegrationSettingService
from board.services.post_service import PostService


def run_inline(func, *args, **kwargs):
    return func(*args, **kwargs)


class AuthorSubscriptionAPITestCase(TestCase):
    """작가 구독/해지/목록 API 테스트"""

    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='writer',
            email='writer@example.com',
            password='testpass123',
            first_name='Writer Name',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR, bio='I write.')

        cls.reader = User.objects.create_user(
            username='reader',
            email='reader@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=cls.reader)

        cls.other_reader = User.objects.create_user(
            username='other-reader',
            email='other-reader@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=cls.other_reader, role=Profile.Role.EDITOR)

    def setUp(self):
        self.client = Client()

    def test_get_state_anonymous(self):
        """비로그인 사용자도 구독 가능 여부를 조회할 수 있다"""
        response = self.client.get('/v1/users/@writer/subscription')

        data = response.json()
        self.assertEqual(data['status'], 'DONE')
        self.assertEqual(data['body'], {'canSubscribe': True, 'isSubscribed': False})

    def test_subscribe_requires_login(self):
        """비로그인 구독 요청은 거부된다"""
        response = self.client.post('/v1/users/@writer/subscription')

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')
        self.assertIn('NL', data['errorCode'])
        self.assertFalse(AuthorSubscription.objects.exists())

    def test_subscribe_author(self):
        """작가를 구독하면 구독 관계가 저장되고 중복 요청은 하나로 유지된다"""
        self.client.login(username='reader', password='testpass123')

        first = self.client.post('/v1/users/@writer/subscription').json()
        second = self.client.post('/v1/users/@writer/subscription').json()

        self.assertEqual(first['status'], 'DONE')
        self.assertTrue(first['body']['isSubscribed'])
        self.assertEqual(second['status'], 'DONE')
        self.assertEqual(
            AuthorSubscription.objects.filter(
                subscriber=self.reader,
                author=self.author,
            ).count(),
            1,
        )
        self.assertEqual(
            list(AuthorSubscriptionLog.objects.values_list('action', flat=True)),
            [AuthorSubscriptionLog.Action.SUBSCRIBE],
        )

        state = self.client.get('/v1/users/@writer/subscription').json()
        self.assertTrue(state['body']['isSubscribed'])

    def configure_telegram_bot(self):
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = True
        setting.telegram_bot_username = 'test_bot'
        setting.telegram_bot_token = IntegrationSettingService.encrypt_secret('token')
        setting.save()

    def test_subscribe_suggests_telegram_when_not_connected(self):
        """텔레그램이 설정된 사이트에서 미연결 사용자가 구독하면 연결을 권한다"""
        self.configure_telegram_bot()
        self.client.login(username='reader', password='testpass123')

        data = self.client.post('/v1/users/@writer/subscription').json()

        self.assertTrue(data['body']['suggestTelegramConnection'])

    def test_subscribe_does_not_suggest_telegram_when_connected(self):
        """이미 텔레그램을 연결한 사용자에게는 권하지 않는다"""
        self.configure_telegram_bot()
        TelegramSync.objects.create(user=self.reader, tid='123456')
        self.client.login(username='reader', password='testpass123')

        data = self.client.post('/v1/users/@writer/subscription').json()

        self.assertFalse(data['body']['suggestTelegramConnection'])

    def test_subscribe_does_not_suggest_telegram_when_site_not_configured(self):
        """사이트에 텔레그램 봇이 없으면 권하지 않는다"""
        self.client.login(username='reader', password='testpass123')

        data = self.client.post('/v1/users/@writer/subscription').json()

        self.assertFalse(data['body']['suggestTelegramConnection'])

    def test_subscribe_self_rejected(self):
        """자기 자신은 구독할 수 없다"""
        self.client.login(username='writer', password='testpass123')

        response = self.client.post('/v1/users/@writer/subscription')

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')
        self.assertIn('RJ', data['errorCode'])
        self.assertFalse(AuthorSubscription.objects.exists())

        state = self.client.get('/v1/users/@writer/subscription').json()
        self.assertFalse(state['body']['canSubscribe'])

    def test_subscribe_reader_account_rejected(self):
        """글을 쓸 수 없는 독자 계정은 구독할 수 없다"""
        self.client.login(username='other-reader', password='testpass123')

        response = self.client.post('/v1/users/@reader/subscription')

        data = response.json()
        self.assertEqual(data['status'], 'ERROR')
        self.assertIn('RJ', data['errorCode'])
        self.assertFalse(AuthorSubscription.objects.exists())

    def test_subscribe_unknown_author(self):
        """존재하지 않는 작가는 404"""
        self.client.login(username='reader', password='testpass123')

        response = self.client.post('/v1/users/@nobody/subscription')

        self.assertEqual(response.status_code, 404)

    def test_unsubscribe_author(self):
        """구독 해지는 구독을 지우고 기록을 한 번만 남기며, 반복해도 안전하다"""
        AuthorSubscription.objects.create(subscriber=self.reader, author=self.author)
        self.client.login(username='reader', password='testpass123')

        first = self.client.delete('/v1/users/@writer/subscription').json()
        second = self.client.delete('/v1/users/@writer/subscription').json()

        self.assertEqual(first['status'], 'DONE')
        self.assertFalse(first['body']['isSubscribed'])
        self.assertEqual(second['status'], 'DONE')
        self.assertFalse(AuthorSubscription.objects.exists())
        self.assertEqual(
            list(AuthorSubscriptionLog.objects.values_list('action', flat=True)),
            [AuthorSubscriptionLog.Action.UNSUBSCRIBE],
        )

    def test_resubscribe_keeps_every_change_in_log(self):
        """해지 후 재구독하면 구독은 하나만 남고, 기록에는 모든 변화가 순서대로 남는다"""
        self.client.login(username='reader', password='testpass123')

        self.client.post('/v1/users/@writer/subscription')
        self.client.delete('/v1/users/@writer/subscription')
        self.client.post('/v1/users/@writer/subscription')

        self.assertEqual(AuthorSubscription.objects.filter(subscriber=self.reader).count(), 1)
        self.assertEqual(
            list(
                AuthorSubscriptionLog.objects
                .filter(subscriber=self.reader, author=self.author)
                .order_by('id')
                .values_list('action', flat=True)
            ),
            [
                AuthorSubscriptionLog.Action.SUBSCRIBE,
                AuthorSubscriptionLog.Action.UNSUBSCRIBE,
                AuthorSubscriptionLog.Action.SUBSCRIBE,
            ],
        )

    def test_rejected_subscription_is_not_logged(self):
        """거부된 구독 요청은 기록을 남기지 않는다"""
        self.client.login(username='writer', password='testpass123')

        self.client.post('/v1/users/@writer/subscription')

        self.assertFalse(AuthorSubscriptionLog.objects.exists())

    def test_unsubscribe_only_affects_own_subscription(self):
        """구독 해지는 내 구독만 지운다"""
        AuthorSubscription.objects.create(subscriber=self.reader, author=self.author)
        AuthorSubscription.objects.create(subscriber=self.other_reader, author=self.author)
        self.client.login(username='reader', password='testpass123')

        self.client.delete('/v1/users/@writer/subscription')

        self.assertFalse(
            AuthorSubscription.objects.filter(subscriber=self.reader).exists()
        )
        self.assertTrue(
            AuthorSubscription.objects.filter(subscriber=self.other_reader).exists()
        )

    def test_list_my_subscriptions(self):
        """설정의 구독 목록은 내 구독만 보여준다"""
        AuthorSubscription.objects.create(subscriber=self.reader, author=self.author)
        AuthorSubscription.objects.create(subscriber=self.reader, author=self.other_reader)
        AuthorSubscription.objects.create(subscriber=self.other_reader, author=self.author)
        self.client.login(username='reader', password='testpass123')

        response = self.client.get('/v1/subscriptions')

        data = response.json()
        self.assertEqual(data['status'], 'DONE')
        self.assertFalse(data['body']['isTelegramConnected'])
        subscriptions = {
            item['username']: item
            for item in data['body']['subscriptions']
        }
        self.assertEqual(set(subscriptions), {'writer', 'other-reader'})
        self.assertEqual(subscriptions['writer']['name'], 'Writer Name')
        self.assertEqual(subscriptions['writer']['bio'], 'I write.')
        self.assertTrue(subscriptions['writer']['isPublishing'])
        self.assertRegex(subscriptions['writer']['subscribedDate'], r'^\d{4}-\d{2}-\d{2}$')

    def test_list_subscriptions_marks_author_no_longer_publishing(self):
        """작가 권한을 잃은 작가는 목록에서 발행 중이 아니라고 표시된다"""
        AuthorSubscription.objects.create(subscriber=self.reader, author=self.other_reader)
        self.other_reader.profile.role = Profile.Role.READER
        self.other_reader.profile.save()
        self.client.login(username='reader', password='testpass123')

        data = self.client.get('/v1/subscriptions').json()

        self.assertFalse(data['body']['subscriptions'][0]['isPublishing'])

    def test_list_subscriptions_reports_telegram_connection(self):
        """텔레그램을 연결한 사용자는 연결 상태가 표시된다"""
        TelegramSync.objects.create(user=self.reader, tid='123456')
        self.client.login(username='reader', password='testpass123')

        data = self.client.get('/v1/subscriptions').json()

        self.assertTrue(data['body']['isTelegramConnected'])

    def test_list_subscriptions_requires_login(self):
        """비로그인 사용자는 구독 목록을 볼 수 없다"""
        data = self.client.get('/v1/subscriptions').json()

        self.assertEqual(data['status'], 'ERROR')
        self.assertIn('NL', data['errorCode'])


@patch('board.services.post_service.WebhookService.notify_channels')
class AuthorSubscriptionNotificationTestCase(TestCase):
    """새 글 발행 시 구독자 알림 테스트"""

    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='writer',
            email='writer@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)

        cls.subscriber = User.objects.create_user(
            username='subscriber',
            email='subscriber@example.com',
            password='testpass123',
        )
        cls.bystander = User.objects.create_user(
            username='bystander',
            email='bystander@example.com',
            password='testpass123',
        )
        AuthorSubscription.objects.create(subscriber=cls.subscriber, author=cls.author)

    def create_post(self, *, hide: bool = False, url: str = 'new-post') -> tuple[Post, PostConfig]:
        post = Post.objects.create(
            author=self.author,
            title='Brand New Post',
            url=url,
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=post, content_html='<p>Hello</p>')
        post_config = PostConfig.objects.create(post=post, hide=hide)
        return post, post_config

    def publish(self, post: Post, post_config: PostConfig) -> None:
        with patch(
            'board.services.author_subscription_service.SubTaskProcessor.process',
            side_effect=run_inline,
        ):
            with self.captureOnCommitCallbacks(execute=True):
                PostService.send_post_notifications(post, post_config)

    def test_publish_notifies_subscribers(self, _mock_webhook):
        """구독자는 새 글 알림을 받고, 구독하지 않은 사람과 작가는 받지 않는다"""
        post, post_config = self.create_post()

        self.publish(post, post_config)

        notification = Notify.objects.get(user=self.subscriber)
        self.assertEqual(notification.message_key, 'post.published')
        self.assertEqual(notification.url, post.get_absolute_url())
        self.assertEqual(
            notification.message_params,
            {'actor': 'writer', 'post_title': 'Brand New Post'},
        )
        self.assertIn('Brand New Post', notification.localized_content())
        self.assertFalse(Notify.objects.filter(user=self.bystander).exists())
        self.assertFalse(Notify.objects.filter(user=self.author).exists())

    def test_hidden_post_does_not_notify(self, _mock_webhook):
        """비공개 글은 구독자에게 알리지 않는다"""
        post, post_config = self.create_post(hide=True)

        self.publish(post, post_config)

        self.assertFalse(Notify.objects.exists())
        self.assertEqual(AuthorSubscriptionService.notify_subscribers(post), 0)

    def test_unsubscribed_reader_is_not_notified(self, _mock_webhook):
        """해지한 구독자에게는 알리지 않는다"""
        AuthorSubscription.objects.filter(subscriber=self.subscriber).delete()
        post, post_config = self.create_post()

        self.publish(post, post_config)

        self.assertFalse(Notify.objects.exists())

    def test_unsubscribe_while_queued_is_honored(self, _mock_webhook):
        """발송 대기 중에 해지하면 보내지 않는다"""
        post, _post_config = self.create_post()
        AuthorSubscription.objects.filter(subscriber=self.subscriber).delete()

        delivered = AuthorSubscriptionService.deliver_post_notifications(
            post.id,
            [self.subscriber.id],
        )

        self.assertEqual(delivered, 0)
        self.assertFalse(Notify.objects.exists())

    def test_inactive_subscriber_is_skipped(self, _mock_webhook):
        """비활성 계정에는 알림을 만들지 않는다"""
        self.subscriber.is_active = False
        self.subscriber.save()
        post, post_config = self.create_post()

        self.publish(post, post_config)

        self.assertFalse(Notify.objects.exists())

    def test_post_hidden_before_delivery_is_skipped(self, _mock_webhook):
        """발송 대기 중 글이 비공개로 바뀌면 보내지 않는다"""
        post, post_config = self.create_post()
        post_config.hide = True
        post_config.save()

        delivered = AuthorSubscriptionService.deliver_post_notifications(
            post.id,
            [self.subscriber.id],
        )

        self.assertEqual(delivered, 0)
        self.assertFalse(Notify.objects.exists())

    def test_repeated_delivery_does_not_duplicate(self, _mock_webhook):
        """같은 글을 두 번 발송해도 알림은 하나만 생긴다"""
        post, _post_config = self.create_post()

        first = AuthorSubscriptionService.deliver_post_notifications(post.id, [self.subscriber.id])
        second = AuthorSubscriptionService.deliver_post_notifications(post.id, [self.subscriber.id])

        self.assertEqual((first, second), (1, 0))
        self.assertEqual(Notify.objects.filter(user=self.subscriber).count(), 1)

    def test_author_who_lost_editor_role_does_not_notify(self, _mock_webhook):
        """작가 권한이 없으면 구독자 알림을 보내지 않는다"""
        self.author.profile.role = Profile.Role.READER
        self.author.profile.save()
        post, _post_config = self.create_post()

        self.assertEqual(AuthorSubscriptionService.notify_subscribers(post), 0)

    @override_settings(SITE_URL='https://example.test')
    @patch('board.services.notification_delivery_service.TelegramBot')
    def test_publish_forwards_to_connected_telegram(self, mock_bot, _mock_webhook):
        """텔레그램을 연결한 구독자에게는 텔레그램으로도 보낸다"""
        setting = IntegrationSetting.get_instance()
        setting.telegram_enabled = True
        setting.telegram_bot_username = 'test_bot'
        setting.telegram_bot_token = IntegrationSettingService.encrypt_secret('token')
        setting.save()
        TelegramSync.objects.create(user=self.subscriber, tid='777')
        post, post_config = self.create_post()

        self.publish(post, post_config)

        mock_bot.return_value.send_messages.assert_called_once()
        telegram_id, messages = mock_bot.return_value.send_messages.call_args.args
        self.assertEqual(telegram_id, '777')
        self.assertEqual(messages[0], f'https://example.test{post.get_absolute_url()}')
        self.assertIn('Brand New Post', messages[1])

from django.contrib import admin
from django.contrib.auth.models import User
from django.db import connection
from django.test import RequestFactory, TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from board.admin.webhook import (
    WebhookSubscriptionAdmin,
    WebhookSubscriptionAdminForm,
)
from board.models import Profile, SiteContentScope, WebhookSubscription


class WebhookSubscriptionAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='webhook-secret-admin',
            email='webhook-secret-admin@example.com',
            password='test',
        )
        cls.user = User.objects.create_user(
            username='webhook-secret-owner',
            password='test',
        )
        cls.profile = Profile.objects.create(user=cls.user)
        cls.secret_url = (
            'https://hooks.example.com/services/private/bearer-token-secret'
        )
        cls.subscription = WebhookSubscription.objects.create(
            scope=SiteContentScope.USER,
            author=cls.profile,
            webhook_url=cls.secret_url,
            name='Private webhook',
        )

    def setUp(self):
        self.model_admin = WebhookSubscriptionAdmin(
            WebhookSubscription,
            admin.site,
        )

    def admin_request(self):
        request = RequestFactory().get('/admin/board/webhooksubscription/')
        request.user = self.admin_user
        return request

    def form_data(self, *, webhook_url=''):
        return {
            'scope': SiteContentScope.USER,
            'author': str(self.profile.pk),
            'webhook_url': webhook_url,
            'name': 'Private webhook',
            'is_active': 'on',
        }

    def test_existing_secret_is_not_selected_for_changelists(self):
        with CaptureQueriesContext(connection) as queries:
            subscriptions = list(
                self.model_admin.get_queryset(self.admin_request()),
            )
            for subscription in subscriptions:
                self.model_admin.author_link(subscription)

        self.assertEqual(len(queries), 1)
        self.assertNotIn(
            'webhook_url',
            queries.captured_queries[0]['sql'].lower(),
        )
        self.assertIn(
            'webhook_url',
            subscriptions[0].get_deferred_fields(),
        )
        self.assertIn(
            'password',
            subscriptions[0].author.user.get_deferred_fields(),
        )

    def test_change_page_uses_blank_password_field_without_secret(self):
        self.client.force_login(self.admin_user)

        response = self.client.get(
            reverse(
                'admin:board_webhooksubscription_change',
                args=[self.subscription.pk],
            ),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'type=password', html=False)
        self.assertContains(response, 'name=webhook_url', html=False)
        self.assertNotContains(response, self.secret_url)
        self.assertNotContains(response, 'bearer-token-secret')

    def test_blank_existing_url_preserves_stored_subscription(self):
        form = WebhookSubscriptionAdminForm(
            data=self.form_data(),
            instance=WebhookSubscription.objects.get(
                pk=self.subscription.pk,
            ),
        )

        self.assertTrue(form.is_valid(), form.errors)
        form.save()

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.webhook_url, self.secret_url)

    def test_explicit_new_url_replaces_stored_subscription(self):
        new_url = 'https://hooks.example.com/services/replacement/secret'
        form = WebhookSubscriptionAdminForm(
            data=self.form_data(webhook_url=new_url),
            instance=WebhookSubscription.objects.get(
                pk=self.subscription.pk,
            ),
        )

        self.assertTrue(form.is_valid(), form.errors)
        form.save()

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.webhook_url, new_url)

    def test_new_subscription_still_requires_url(self):
        form = WebhookSubscriptionAdminForm(data={
            'scope': SiteContentScope.GLOBAL,
            'author': '',
            'webhook_url': '',
            'name': 'Missing URL',
            'is_active': 'on',
        })

        self.assertFalse(form.is_valid())
        self.assertIn('웹훅 URL을 입력하세요.', form.errors['webhook_url'])

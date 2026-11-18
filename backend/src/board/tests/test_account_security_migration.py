import pyotp

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import Client, TransactionTestCase

from board.models import Config, Profile, SocialAuth, SocialAuthProvider, TwoFactorAuth, User
from board.services.developer_token_service import DeveloperTokenService


class AccountSecurityMigrationTestCase(TransactionTestCase):
    previous_schema = [('board', '0064_notify_structured_message')]
    account_security_schema = [('board', '0065_login_attempt_and_oauth_authorization')]

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_upgrade_keeps_existing_sessions_and_credentials_usable(self):
        MigrationExecutor(connection).migrate(self.previous_schema)
        user = User.objects.create_user(username='existing-member', password='old123')
        Config.objects.create(user=user)
        profile = Profile.objects.create(user=user, role=Profile.Role.EDITOR, cover='images/avatar/old-cover.png')
        provider, _ = SocialAuthProvider.objects.get_or_create(key='github')
        link = SocialAuth.objects.create(user=user, provider=provider, uid='existing-account')
        totp_secret = pyotp.random_base32()
        recovery_key = 'existing-member-recovery-key'
        TwoFactorAuth.objects.create(user=user, totp_secret=totp_secret, recovery_key=recovery_key)
        raw_token, _ = DeveloperTokenService.create_token(user, scopes=['posts:read'])
        self.client.force_login(user)
        existing_session = self.client.session.session_key

        MigrationExecutor(connection).migrate(self.account_security_schema)

        self.assertEqual(self.client.get('/v1/login').json()['body']['username'], user.username)
        self.assertEqual(self.client.session.session_key, existing_session)
        self.assertEqual(Profile.objects.get(pk=profile.pk).cover.name, 'images/avatar/old-cover.png')
        self.assertEqual(SocialAuth.objects.get(pk=link.pk).uid, 'existing-account')
        self.assertEqual(self.client.get('/api/developer/v1/me', HTTP_AUTHORIZATION=f'Bearer {raw_token}').status_code, 200)

        for code in (pyotp.TOTP(totp_secret).now(), recovery_key):
            with self.subTest(credential_type=len(code)):
                result = Client().post('/v1/login', {'username': user.username, 'password': 'old123', 'code': code})
                self.assertEqual(result.json()['status'], 'DONE')

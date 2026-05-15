from django.test import TestCase

from board.models import TelegramSync, User
from modules.cipher import encrypt_value


class TelegramSyncSaveHookTestCase(TestCase):
    """Characterization tests for TelegramSync.save() encryption behavior."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='telegram-sync-user',
            password='test',
            email='telegram-sync-user@test.com',
        )

    def test_save_encrypts_plaintext_tid(self):
        sync = TelegramSync.objects.create(user=self.user, tid='123456')

        self.assertNotEqual(sync.tid, '123456')
        self.assertEqual(sync.get_decrypted_tid(), '123456')

        sync.refresh_from_db()
        self.assertNotEqual(sync.tid, '123456')
        self.assertEqual(sync.get_decrypted_tid(), '123456')

    def test_save_leaves_blank_tid_unchanged(self):
        sync = TelegramSync.objects.create(user=self.user, tid='')

        self.assertEqual(sync.tid, '')
        self.assertEqual(sync.get_decrypted_tid(), '')

        sync.refresh_from_db()
        self.assertEqual(sync.tid, '')
        self.assertEqual(sync.get_decrypted_tid(), '')

    def test_save_preserves_already_encrypted_tid(self):
        encrypted_tid = encrypt_value('123456').decode()

        sync = TelegramSync.objects.create(user=self.user, tid=encrypted_tid)

        self.assertEqual(sync.tid, encrypted_tid)
        self.assertEqual(sync.get_decrypted_tid(), '123456')

        sync.refresh_from_db()
        self.assertEqual(sync.tid, encrypted_tid)
        self.assertEqual(sync.get_decrypted_tid(), '123456')

    def test_resave_preserves_encrypted_tid(self):
        sync = TelegramSync.objects.create(user=self.user, tid='123456')
        encrypted_tid = sync.tid

        sync.auth_token = 'ABC123'
        sync.save()

        self.assertEqual(sync.tid, encrypted_tid)
        self.assertEqual(sync.get_decrypted_tid(), '123456')

        sync.refresh_from_db()
        self.assertEqual(sync.tid, encrypted_tid)
        self.assertEqual(sync.get_decrypted_tid(), '123456')

    def test_save_encrypts_invalid_ciphertext_as_plaintext(self):
        sync = TelegramSync.objects.create(user=self.user, tid='not-a-fernet-token')

        self.assertNotEqual(sync.tid, 'not-a-fernet-token')
        self.assertEqual(sync.get_decrypted_tid(), 'not-a-fernet-token')

        sync.refresh_from_db()
        self.assertNotEqual(sync.tid, 'not-a-fernet-token')
        self.assertEqual(sync.get_decrypted_tid(), 'not-a-fernet-token')

    def test_get_decrypted_tid_returns_empty_for_invalid_ciphertext(self):
        sync = TelegramSync(user=self.user, tid='not-a-fernet-token')

        self.assertEqual(sync.get_decrypted_tid(), '')

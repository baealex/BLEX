from django.core.files.base import ContentFile
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class WorkLogMigrationTests(TransactionTestCase):
    migrate_from = [('board', '0066_post_share_links')]
    migrate_to = [('board', '0067_work_log_snapshots')]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_upgrade_creates_file_backed_work_logs_and_preserves_post_share_links(self):
        old_apps = self.migrate(self.migrate_from)
        User = old_apps.get_model('auth', 'User')
        Post = old_apps.get_model('board', 'Post')
        author = User.objects.create(username='work-log-migration-author')
        post = Post.objects.create(author=author, title='Existing post', url='existing-post')
        post_link = old_apps.get_model('board', 'PostShareLink').objects.create(
            post=post, token='existing-link', label='Existing link',
        )

        new_apps = self.migrate(self.migrate_to)
        self.assertEqual(new_apps.get_model('board', 'Post').objects.get(pk=post.pk).title, 'Existing post')
        self.assertEqual(
            new_apps.get_model('board', 'PostShareLink').objects.get(token=post_link.token).post_id,
            post.pk,
        )
        WorkLog = new_apps.get_model('board', 'WorkLog')
        WorkLogEntry = new_apps.get_model('board', 'WorkLogEntry')
        WorkLogShare = new_apps.get_model('board', 'WorkLogShare')

        log = WorkLog.objects.create(owner_id=author.pk, title='Work log')
        entry = WorkLogEntry(log=log, media_type='image/png')
        payload = b'example attachment'
        entry.attachment.save('entry.png', ContentFile(payload))
        with entry.attachment.open('rb') as attachment:
            self.assertEqual(attachment.read(), payload)
        share = WorkLogShare.objects.create(log=log, headline='Shared update')
        share.entries.add(entry)
        self.assertEqual(share.entries.get().pk, entry.pk)

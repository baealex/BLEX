from datetime import timedelta

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class EditHistoryMigrationTestCase(TransactionTestCase):
    migrate_from = [('board', '0056_tag_value_unique_constraint')]
    migrate_to = [('board', '0057_alter_edithistory_options_edithistory_actor_and_more')]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_existing_rows_survive_forward_and_reverse_migration(self):
        old_apps = self.migrate(self.migrate_from)
        User = old_apps.get_model('auth', 'User')
        Post = old_apps.get_model('board', 'Post')
        EditHistory = old_apps.get_model('board', 'EditHistory')
        author = User.objects.create(username='legacy-history-author')
        post = Post.objects.create(
            author=author,
            title='Legacy post',
            url='legacy-history-post',
        )
        created_date = timezone.now() - timedelta(days=30)
        history = EditHistory.objects.create(
            post=post,
            title='Legacy title',
            content='Legacy unknown content',
            created_date=created_date,
        )

        new_apps = self.migrate(self.migrate_to)
        MigratedHistory = new_apps.get_model('board', 'EditHistory')
        migrated = MigratedHistory.objects.get(pk=history.pk)
        self.assertEqual(migrated.post_id, post.pk)
        self.assertEqual(migrated.title, 'Legacy title')
        self.assertEqual(migrated.content, 'Legacy unknown content')
        self.assertEqual(migrated.created_date, created_date)
        self.assertEqual(migrated.actor_id, author.pk)
        self.assertEqual(migrated.source_updated_date, created_date)
        self.assertEqual(migrated.change_type, 'legacy')
        self.assertEqual(migrated.subtitle, '')
        self.assertEqual(migrated.description, '')
        self.assertEqual(migrated.tags, [])
        self.assertIsNone(migrated.restored_from_id)

        reversed_apps = self.migrate(self.migrate_from)
        ReversedHistory = reversed_apps.get_model('board', 'EditHistory')
        reversed_history = ReversedHistory.objects.get(pk=history.pk)
        self.assertEqual(reversed_history.post_id, post.pk)
        self.assertEqual(reversed_history.title, 'Legacy title')
        self.assertEqual(reversed_history.content, 'Legacy unknown content')
        self.assertEqual(reversed_history.created_date, created_date)

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class PostTrashMigrationTestCase(TransactionTestCase):
    migrate_from = [('board', '0057_alter_edithistory_options_edithistory_actor_and_more')]
    migrate_to = [('board', '0058_post_deleted_date')]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_existing_rows_survive_and_reverse_requires_empty_trash(self):
        old_apps = self.migrate(self.migrate_from)
        User = old_apps.get_model('auth', 'User')
        Post = old_apps.get_model('board', 'Post')
        author = User.objects.create(username='trash-migration-author')
        post = Post.objects.create(
            author=author,
            title='Existing post',
            url='existing-trash-migration-post',
        )

        new_apps = self.migrate(self.migrate_to)
        MigratedPost = new_apps.get_model('board', 'Post')
        migrated = MigratedPost.objects.get(pk=post.pk)
        self.assertIsNone(migrated.deleted_date)
        self.assertEqual(migrated.title, 'Existing post')
        self.assertEqual(migrated.url, 'existing-trash-migration-post')

        MigratedPost.objects.filter(pk=post.pk).update(deleted_date=timezone.now())
        with self.assertRaisesRegex(RuntimeError, '휴지통 포스트'):
            self.migrate(self.migrate_from)

        MigratedPost.objects.filter(pk=post.pk).update(deleted_date=None)
        reversed_apps = self.migrate(self.migrate_from)
        ReversedPost = reversed_apps.get_model('board', 'Post')
        reversed_post = ReversedPost.objects.get(pk=post.pk)
        self.assertEqual(reversed_post.title, 'Existing post')
        self.assertEqual(reversed_post.url, 'existing-trash-migration-post')

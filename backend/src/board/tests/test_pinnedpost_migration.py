from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class PinnedPostUniqueMigrationTestCase(TransactionTestCase):
    migrate_from = [('board', '0054_postlikes_unique_constraint')]
    migrate_to = [('board', '0055_pinnedpost_unique_constraint')]

    def migrate_to_old_state(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        return executor.loader.project_state(self.migrate_from).apps

    def migrate_to_new_state(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        return executor.loader.project_state(self.migrate_to).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    @staticmethod
    def create_post(Post, author, url):
        return Post.objects.create(author=author, title=url, url=url)

    def test_migration_preserves_users_without_duplicates(self):
        old_apps = self.migrate_to_old_state()
        User = old_apps.get_model('auth', 'User')
        Post = old_apps.get_model('board', 'Post')
        PinnedPost = old_apps.get_model('board', 'PinnedPost')
        user = User.objects.create(username='valid-pinned-user')
        first_post = self.create_post(Post, user, 'valid-pinned-first')
        second_post = self.create_post(Post, user, 'valid-pinned-second')
        first = PinnedPost.objects.create(user=user, post=first_post, order=3)
        second = PinnedPost.objects.create(user=user, post=second_post, order=7)

        new_apps = self.migrate_to_new_state()
        MigratedPinnedPost = new_apps.get_model('board', 'PinnedPost')

        self.assertEqual(MigratedPinnedPost.objects.get(pk=first.pk).order, 3)
        self.assertEqual(MigratedPinnedPost.objects.get(pk=second.pk).order, 7)

    def test_migration_keeps_public_order_and_closes_gaps_after_deduplication(self):
        old_apps = self.migrate_to_old_state()
        User = old_apps.get_model('auth', 'User')
        Post = old_apps.get_model('board', 'Post')
        PinnedPost = old_apps.get_model('board', 'PinnedPost')
        user = User.objects.create(username='duplicate-pinned-user')
        first_post = self.create_post(Post, user, 'duplicate-pinned-first')
        second_post = self.create_post(Post, user, 'duplicate-pinned-second')
        third_post = self.create_post(Post, user, 'duplicate-pinned-third')
        kept = PinnedPost.objects.create(user=user, post=first_post, order=0)
        second = PinnedPost.objects.create(user=user, post=second_post, order=1)
        PinnedPost.objects.create(user=user, post=first_post, order=2)
        third = PinnedPost.objects.create(user=user, post=third_post, order=4)

        new_apps = self.migrate_to_new_state()
        MigratedPinnedPost = new_apps.get_model('board', 'PinnedPost')
        remaining = list(
            MigratedPinnedPost.objects.filter(user_id=user.pk).order_by('order', 'pk')
        )

        self.assertEqual([item.pk for item in remaining], [kept.pk, second.pk, third.pk])
        self.assertEqual([item.order for item in remaining], [0, 1, 2])

from datetime import timedelta

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class PostLikesUniqueMigrationTestCase(TransactionTestCase):
    migrate_from = [('board', '0053_encrypt_two_factor_auth_secrets')]
    migrate_to = [('board', '0054_postlikes_unique_constraint')]

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

    def test_migration_preserves_database_without_duplicates(self):
        old_apps = self.migrate_to_old_state()
        User = old_apps.get_model('auth', 'User')
        Post = old_apps.get_model('board', 'Post')
        PostLikes = old_apps.get_model('board', 'PostLikes')
        author = User.objects.create(username='no-duplicate-author')
        reader = User.objects.create(username='no-duplicate-reader')
        post = Post.objects.create(
            author=author,
            title='Valid Migration Like',
            url='valid-migration-like',
        )
        valid_like = PostLikes.objects.create(post=post, user=reader)

        new_apps = self.migrate_to_new_state()
        MigratedPostLikes = new_apps.get_model('board', 'PostLikes')

        self.assertTrue(MigratedPostLikes.objects.filter(pk=valid_like.pk).exists())

    def test_migration_keeps_earliest_duplicate_and_preserves_valid_like(self):
        old_apps = self.migrate_to_old_state()

        User = old_apps.get_model('auth', 'User')
        Post = old_apps.get_model('board', 'Post')
        PostLikes = old_apps.get_model('board', 'PostLikes')
        author = User.objects.create(username='migration-author')
        duplicate_user = User.objects.create(username='migration-duplicate')
        valid_user = User.objects.create(username='migration-valid')
        post = Post.objects.create(
            author=author,
            title='Migration Like',
            url='migration-like',
        )
        earliest = timezone.now() - timedelta(days=2)
        later = timezone.now() - timedelta(days=1)
        kept_like = PostLikes.objects.create(
            post=post,
            user=duplicate_user,
            created_date=earliest,
        )
        PostLikes.objects.create(
            post=post,
            user=duplicate_user,
            created_date=later,
        )
        valid_like = PostLikes.objects.create(
            post=post,
            user=valid_user,
            created_date=later,
        )

        new_apps = self.migrate_to_new_state()
        MigratedPostLikes = new_apps.get_model('board', 'PostLikes')

        duplicate_likes = MigratedPostLikes.objects.filter(
            post_id=post.pk,
            user_id=duplicate_user.pk,
        )
        self.assertEqual(duplicate_likes.count(), 1)
        self.assertEqual(duplicate_likes.get().pk, kept_like.pk)
        self.assertEqual(duplicate_likes.get().created_date, earliest)
        self.assertTrue(MigratedPostLikes.objects.filter(pk=valid_like.pk).exists())

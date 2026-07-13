from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class TagUniqueMigrationTestCase(TransactionTestCase):
    migrate_from = [('board', '0055_pinnedpost_unique_constraint')]
    migrate_to = [('board', '0056_tag_value_unique_constraint')]

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
    def tag_values_by_post(Post):
        return {
            post.pk: set(post.tags.values_list('value', flat=True))
            for post in Post.objects.order_by('pk')
        }

    def test_migration_merges_all_links_into_oldest_tag_without_value_loss(self):
        old_apps = self.migrate_to_old_state()
        User = old_apps.get_model('auth', 'User')
        Post = old_apps.get_model('board', 'Post')
        Tag = old_apps.get_model('board', 'Tag')
        user = User.objects.create(username='tag-migration-user')
        canonical = Tag.objects.create(value='python')
        duplicate = Tag.objects.create(value='python')
        capitalized = Tag.objects.create(value='Python')
        unicode_canonical = Tag.objects.create(value='태그')
        unicode_duplicate = Tag.objects.create(value='태그')

        canonical_post = Post.objects.create(author=user, title='Canonical', url='canonical-tag')
        duplicate_post = Post.objects.create(author=user, title='Duplicate', url='duplicate-tag')
        shared_post = Post.objects.create(author=user, title='Shared', url='shared-tag')
        unicode_post = Post.objects.create(author=user, title='Unicode', url='unicode-tag')
        canonical_post.tags.add(canonical, capitalized)
        duplicate_post.tags.add(duplicate)
        shared_post.tags.add(canonical, duplicate)
        unicode_post.tags.add(unicode_duplicate)
        values_before = self.tag_values_by_post(Post)

        new_apps = self.migrate_to_new_state()
        MigratedPost = new_apps.get_model('board', 'Post')
        MigratedTag = new_apps.get_model('board', 'Tag')

        self.assertEqual(self.tag_values_by_post(MigratedPost), values_before)
        self.assertEqual(
            list(MigratedTag.objects.filter(value='python').values_list('pk', flat=True)),
            [canonical.pk],
        )
        self.assertEqual(
            list(MigratedTag.objects.filter(value='태그').values_list('pk', flat=True)),
            [unicode_canonical.pk],
        )
        self.assertTrue(MigratedTag.objects.filter(pk=capitalized.pk, value='Python').exists())

        canonical_post_ids = set(
            MigratedTag.objects.get(pk=canonical.pk).posts.values_list('pk', flat=True)
        )
        self.assertEqual(
            canonical_post_ids,
            {canonical_post.pk, duplicate_post.pk, shared_post.pk},
        )

    def test_migration_preserves_database_without_duplicates(self):
        old_apps = self.migrate_to_old_state()
        User = old_apps.get_model('auth', 'User')
        Post = old_apps.get_model('board', 'Post')
        Tag = old_apps.get_model('board', 'Tag')
        user = User.objects.create(username='valid-tag-migration-user')
        tag = Tag.objects.create(value='unchanged')
        post = Post.objects.create(author=user, title='Unchanged', url='unchanged-tag')
        post.tags.add(tag)
        values_before = self.tag_values_by_post(Post)

        new_apps = self.migrate_to_new_state()
        MigratedPost = new_apps.get_model('board', 'Post')
        MigratedTag = new_apps.get_model('board', 'Tag')

        self.assertEqual(self.tag_values_by_post(MigratedPost), values_before)
        self.assertTrue(MigratedTag.objects.filter(pk=tag.pk, value='unchanged').exists())

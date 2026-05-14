from django.test import TestCase
from django.utils import timezone

from board.models import Config, Post, PostConfig, PostContent, Profile, Series, User
from board.services.series_serializer import SeriesSerializer


class SeriesSerializerTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='series-user', password='test')
        Config.objects.create(user=self.user)
        Profile.objects.create(user=self.user)
        self.series = Series.objects.create(
            owner=self.user,
            name='Serializer Series',
            url='serializer-series',
            text_md='Description',
        )
        self.series.owner_username = self.user.username
        self.series.owner_avatar = ''
        self.series.total_posts = 1
        self.post = Post.objects.create(
            author=self.user,
            title='Serializer Post',
            url='serializer-post',
            series=self.series,
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=self.post, content_html='<p>content</p>')
        PostConfig.objects.create(post=self.post, hide=False)

    def test_available_post_preserves_contract(self):
        payload = SeriesSerializer.available_post(self.post)

        self.assertEqual(payload['id'], self.post.id)
        self.assertEqual(payload['title'], 'Serializer Post')
        self.assertIn('publishedDate', payload)

    def test_public_continue_detail_preserves_contract(self):
        payload = SeriesSerializer.public_continue_detail(
            self.series,
            [('Serializer Post', 'serializer-post')],
        )

        self.assertEqual(payload['name'], 'Serializer Series')
        self.assertEqual(payload['total_posts'], 1)
        self.assertEqual(
            payload['posts'],
            [{'title': 'Serializer Post', 'url': 'serializer-post'}],
        )

    def test_owner_detail_preserves_post_id_contract(self):
        payload = SeriesSerializer.owner_detail(self.series, [self.post.id])

        self.assertEqual(payload['id'], self.series.id)
        self.assertEqual(payload['post_ids'], [self.post.id])
        self.assertEqual(payload['post_count'], 1)

    def test_mutation_detail_preserves_post_count_contract(self):
        payload = SeriesSerializer.mutation_detail(self.series)

        self.assertEqual(payload['id'], self.series.id)
        self.assertEqual(payload['postCount'], 1)

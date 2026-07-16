from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone

from board.models import Post, PostConfig, Profile, Series, SiteSetting, StaticPage


@override_settings(SITE_URL='http://localhost:8000')
class SitemapPerformanceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        author = User.objects.create_user(username='sitemap-author')
        Profile.objects.create(user=author, role=Profile.Role.EDITOR)
        series = Series.objects.create(
            owner=author,
            name='Sitemap Series',
            url='sitemap-series',
        )

        for index in range(3):
            post = Post.objects.create(
                author=author,
                series=series,
                title=f'Sitemap Post {index}',
                url=f'sitemap-post-{index}',
                published_date=timezone.now(),
            )
            PostConfig.objects.create(post=post, hide=False, advertise=False)

        StaticPage.objects.create(
            slug='sitemap-page',
            title='Sitemap Page',
            content='Public page',
            is_published=True,
        )
        setting = SiteSetting.get_instance()
        setting.seo_enabled = True
        setting.save(update_fields=['seo_enabled'])

    def test_sitemap_index_uses_one_metadata_query_per_database_section(self):
        """루트 sitemap은 섹션별 메타데이터를 단일 쿼리로 조회한다."""
        with self.assertNumQueries(5):
            response = self.client.get('/sitemap.xml')

        self.assertEqual(response.status_code, 200)

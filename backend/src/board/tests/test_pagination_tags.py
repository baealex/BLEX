from django.test import RequestFactory, SimpleTestCase

from board.templatetags.pagination_tags import get_pagination_url


class PaginationUrlTagTestCase(SimpleTestCase):
    def setUp(self):
        self.request_factory = RequestFactory()

    def test_first_page_url_omits_default_page_query(self):
        """첫 페이지 내부 링크는 기본 page=1 쿼리를 만들지 않는다."""
        request = self.request_factory.get(
            '/@author/series/example',
            {'sort': 'asc', 'page': 2},
        )

        url = get_pagination_url({'request': request}, 1)

        self.assertEqual(url, '?sort=asc')

    def test_first_page_url_uses_clean_path_without_other_queries(self):
        """다른 쿼리가 없으면 첫 페이지 링크는 현재 경로를 사용한다."""
        request = self.request_factory.get('/posts', {'page': 2})

        url = get_pagination_url({'request': request}, 1)

        self.assertEqual(url, '/posts')

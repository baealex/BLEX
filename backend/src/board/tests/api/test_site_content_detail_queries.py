from django.contrib.auth.models import User
from django.db import connection
from django.test import RequestFactory, TestCase
from django.test.utils import CaptureQueriesContext

from board.models import (
    Form,
    Profile,
    SiteBanner,
    SiteContentScope,
    SiteNotice,
    StaticPage,
)
from board.views.api.v1.banner import banner
from board.views.api.v1.form import forms_detail
from board.views.api.v1.global_banner import global_banners
from board.views.api.v1.global_notice import global_notices
from board.views.api.v1.notice import notices
from board.views.api.v1.static_page import static_pages


class SiteContentDetailQueryTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='content-owner',
            password='test',
            is_staff=True,
        )
        Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        cls.form = Form.objects.create(
            user=cls.user,
            title='Form',
            content='Form content',
            is_public=True,
        )
        cls.user_notice = SiteNotice.objects.create(
            scope=SiteContentScope.USER,
            user=cls.user,
            title='User notice',
            url='/notice',
        )
        cls.global_notice = SiteNotice.objects.create(
            scope=SiteContentScope.GLOBAL,
            title='Global notice',
            url='/global-notice',
        )
        cls.user_banner = SiteBanner.objects.create(
            scope=SiteContentScope.USER,
            user=cls.user,
            title='User banner',
            content_html='<p>Banner</p>',
        )
        cls.global_banner = SiteBanner.objects.create(
            scope=SiteContentScope.GLOBAL,
            user=cls.user,
            title='Global banner',
            content_html='<p>Global banner</p>',
        )
        cls.static_page = StaticPage.objects.create(
            author=cls.user,
            title='Static page',
            slug='static-page',
            content='<p>Static</p>',
        )

    def setUp(self):
        self.factory = RequestFactory()
        # Cache the reverse one-to-one relation used by editor authorization so
        # each assertion isolates the content detail query.
        self.user.profile

    def assert_detail_query(self, view, table, excluded_columns, *args):
        request = self.factory.get('/v1/detail')
        request.user = self.user

        with CaptureQueriesContext(connection) as queries:
            response = view(request, *args)

        self.assertEqual(response.status_code, 200)
        table_queries = [
            query['sql'] for query in queries if f'FROM "{table}"' in query['sql']
        ]
        self.assertEqual(len(table_queries), 1)
        selected_columns = table_queries[0].split(' FROM ')[0]
        for column in excluded_columns:
            self.assertNotIn(f'"{table}"."{column}"', selected_columns)

    def test_form_detail_omits_unused_columns(self):
        self.assert_detail_query(
            forms_detail,
            'board_form',
            ('user_id', 'is_public', 'created_date', 'updated_date'),
            self.form.id,
        )

    def test_user_notice_detail_omits_scope_and_ownership_columns(self):
        self.assert_detail_query(
            notices,
            'board_sitenotice',
            ('scope', 'user_id', 'order'),
            self.user_notice.id,
        )

    def test_global_notice_detail_omits_scope_and_ownership_columns(self):
        self.assert_detail_query(
            global_notices,
            'board_sitenotice',
            ('scope', 'user_id', 'order'),
            self.global_notice.id,
        )

    def test_user_banner_detail_omits_scope_and_ownership_columns(self):
        self.assert_detail_query(
            banner,
            'board_sitebanner',
            ('scope', 'user_id'),
            self.user_banner.id,
        )

    def test_global_banner_detail_omits_unused_creator_columns(self):
        self.assert_detail_query(
            global_banners,
            'board_sitebanner',
            ('scope',),
            self.global_banner.id,
        )

    def test_static_page_detail_omits_author_column(self):
        self.assert_detail_query(
            static_pages,
            'board_staticpage',
            ('author_id',),
            self.static_page.id,
        )

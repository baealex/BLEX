from datetime import timedelta
from unittest.mock import patch

from django.contrib import admin
from django.contrib.admin import helpers
from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.contrib.messages.storage.fallback import FallbackStorage
from django.template.response import TemplateResponse
from django.test import RequestFactory, TestCase
from django.utils import timezone

from board.admin.banner import SiteBannerAdmin, SiteNoticeAdmin
from board.admin.series import SeriesAdmin
from board.models import (
    Series,
    SiteBanner,
    SiteContentScope,
    SiteNotice,
)


class PublicActionAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='public-action-admin',
            email='public-action-admin@example.com',
            password='test',
        )
        cls.owner = User.objects.create_user(
            username='series-owner',
            password='test',
        )

    def setUp(self):
        self.series_admin = SeriesAdmin(Series, admin.site)
        self.notice_admin = SiteNoticeAdmin(SiteNotice, admin.site)
        self.banner_admin = SiteBannerAdmin(SiteBanner, admin.site)

    def admin_request(self, data=None):
        request = RequestFactory().post('/admin/', data=data or {})
        request.user = self.admin_user
        request.session = {}
        request._messages = FallbackStorage(request)
        return request

    @staticmethod
    def action_selection(action: str, object_id: int) -> dict[str, object]:
        return {
            helpers.ACTION_CHECKBOX_NAME: [str(object_id)],
            'action': action,
            'select_across': '0',
        }

    @staticmethod
    def change_log_exists(obj, message: str) -> bool:
        return LogEntry.objects.filter(
            content_type=ContentType.objects.get_for_model(obj),
            object_id=str(obj.pk),
            action_flag=CHANGE,
            change_message__contains=message,
        ).exists()

    def admin_series_queryset(self, series: Series):
        return self.series_admin.get_queryset(
            self.admin_request(),
        ).filter(pk=series.pk)

    def test_series_publication_requires_confirmation_and_is_audited(self):
        series = Series.objects.create(
            owner=self.owner,
            name='Hidden series',
            url='hidden-series',
            hide=True,
        )
        previous_updated_date = timezone.now() - timedelta(days=1)
        Series.objects.filter(pk=series.pk).update(
            updated_date=previous_updated_date,
        )
        selection = self.action_selection('make_visible', series.pk)

        confirmation = self.series_admin.make_visible(
            self.admin_request(selection),
            self.admin_series_queryset(series),
        )

        self.assertIsInstance(confirmation, TemplateResponse)
        confirmation.render()
        self.assertEqual(
            confirmation.context_data['confirm_button_class'],
            'default',
        )
        series.refresh_from_db()
        self.assertTrue(series.hide)
        self.assertFalse(self.change_log_exists(series, '공개 처리'))

        self.series_admin.make_visible(
            self.admin_request({**selection, 'confirm': 'yes'}),
            self.admin_series_queryset(series),
        )

        series.refresh_from_db()
        self.assertFalse(series.hide)
        self.assertGreater(series.updated_date, previous_updated_date)
        self.assertTrue(self.change_log_exists(series, '공개 처리'))

    def test_series_actions_update_timestamp_and_rollback_without_audit(self):
        series = Series.objects.create(
            owner=self.owner,
            name='Audited series',
            url='audited-series',
            layout='list',
            hide=False,
        )
        previous_updated_date = timezone.now() - timedelta(days=1)
        Series.objects.filter(pk=series.pk).update(
            updated_date=previous_updated_date,
        )

        self.series_admin.set_layout_card(
            self.admin_request(),
            self.admin_series_queryset(series),
        )

        series.refresh_from_db()
        self.assertEqual(series.layout, 'card')
        self.assertGreater(series.updated_date, previous_updated_date)
        self.assertTrue(self.change_log_exists(series, '카드 레이아웃'))

        with patch.object(
            self.series_admin,
            'log_change',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.series_admin.make_hidden(
                    self.admin_request(),
                    self.admin_series_queryset(series),
                )

        series.refresh_from_db()
        self.assertFalse(series.hide)

    def test_site_content_activation_requires_confirmation_and_is_audited(self):
        admin_records = [
            (
                self.notice_admin,
                SiteNotice.objects.create(
                    scope=SiteContentScope.GLOBAL,
                    title='Inactive notice',
                    is_active=False,
                ),
            ),
            (
                self.banner_admin,
                SiteBanner.objects.create(
                    scope=SiteContentScope.GLOBAL,
                    title='Inactive banner',
                    is_active=False,
                ),
            ),
        ]

        for model_admin, item in admin_records:
            with self.subTest(model=item._meta.label):
                previous_updated_date = timezone.now() - timedelta(days=1)
                item.__class__.objects.filter(pk=item.pk).update(
                    updated_date=previous_updated_date,
                )
                selection = self.action_selection('activate_items', item.pk)

                confirmation = model_admin.activate_items(
                    self.admin_request(selection),
                    item.__class__.objects.filter(pk=item.pk),
                )

                self.assertIsInstance(confirmation, TemplateResponse)
                confirmation.render()
                self.assertEqual(
                    confirmation.context_data['confirm_button_class'],
                    'default',
                )
                item.refresh_from_db()
                self.assertFalse(item.is_active)
                self.assertFalse(self.change_log_exists(item, '활성화'))

                model_admin.activate_items(
                    self.admin_request({**selection, 'confirm': 'yes'}),
                    item.__class__.objects.filter(pk=item.pk),
                )

                item.refresh_from_db()
                self.assertTrue(item.is_active)
                self.assertGreater(item.updated_date, previous_updated_date)
                self.assertTrue(self.change_log_exists(item, '활성화'))

    def test_site_content_deactivation_is_audited_and_atomic(self):
        notice = SiteNotice.objects.create(
            scope=SiteContentScope.GLOBAL,
            title='Active notice',
            is_active=True,
        )
        previous_updated_date = timezone.now() - timedelta(days=1)
        SiteNotice.objects.filter(pk=notice.pk).update(
            updated_date=previous_updated_date,
        )

        self.notice_admin.deactivate_items(
            self.admin_request(),
            SiteNotice.objects.filter(pk=notice.pk),
        )

        notice.refresh_from_db()
        self.assertFalse(notice.is_active)
        self.assertGreater(notice.updated_date, previous_updated_date)
        self.assertTrue(self.change_log_exists(notice, '비활성화'))

        banner = SiteBanner.objects.create(
            scope=SiteContentScope.GLOBAL,
            title='Active banner',
            is_active=True,
        )
        with patch.object(
            self.banner_admin,
            'log_change',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.banner_admin.deactivate_items(
                    self.admin_request(),
                    SiteBanner.objects.filter(pk=banner.pk),
                )

        banner.refresh_from_db()
        self.assertTrue(banner.is_active)

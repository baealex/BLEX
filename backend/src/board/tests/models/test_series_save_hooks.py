from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from board.models import Series, User


class SeriesSaveHookTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='series-save-user',
            password='test',
            email='series-save-user@test.com',
        )

    def test_save_generates_url_from_name_when_url_is_empty(self):
        series = Series.objects.create(
            owner=self.user,
            name='Hello Series',
            url='',
        )

        self.assertEqual(series.url, 'hello-series')
        series.refresh_from_db()
        self.assertEqual(series.url, 'hello-series')


    def test_existing_series_empty_url_regenerates_with_self_collision_suffix(self):
        series = Series.objects.create(
            owner=self.user,
            name='Hello Series',
            url='',
        )
        self.assertEqual(series.url, 'hello-series')

        with patch('board.models.randstr', return_value='efgh5678'):
            series.url = ''
            series.save()

        self.assertEqual(series.url, 'hello-series-efgh5678')
        series.refresh_from_db()
        self.assertEqual(series.url, 'hello-series-efgh5678')

    def test_save_preserves_explicit_url(self):
        series = Series.objects.create(
            owner=self.user,
            name='Hello Series',
            url='custom-series-url',
        )

        self.assertEqual(series.url, 'custom-series-url')
        series.refresh_from_db()
        self.assertEqual(series.url, 'custom-series-url')

    def test_save_generates_unique_url_when_slug_collides(self):
        Series.objects.create(
            owner=self.user,
            name='Existing Series',
            url='hello-series',
        )

        with patch('board.models.randstr', return_value='abcd1234'):
            series = Series.objects.create(
                owner=self.user,
                name='Hello Series',
                url='',
            )

        self.assertEqual(series.url, 'hello-series-abcd1234')
        series.refresh_from_db()
        self.assertEqual(series.url, 'hello-series-abcd1234')

    def test_save_refreshes_updated_date_on_regular_save(self):
        initial_time = timezone.now() - timezone.timedelta(days=1)
        next_time = timezone.now()
        with patch('board.models.timezone.now', return_value=initial_time):
            series = Series.objects.create(
                owner=self.user,
                name='Timestamp Series',
                url='timestamp-series',
            )

        with patch('board.models.timezone.now', return_value=next_time):
            series.name = 'Timestamp Series Updated'
            series.save()

        series.refresh_from_db()
        self.assertEqual(series.updated_date, next_time)

    def test_save_with_update_fields_changes_instance_updated_date_but_not_database_value(self):
        initial_time = timezone.now() - timezone.timedelta(days=1)
        next_time = timezone.now()
        with patch('board.models.timezone.now', return_value=initial_time):
            series = Series.objects.create(
                owner=self.user,
                name='Partial Save Series',
                url='partial-save-series',
            )

        with patch('board.models.timezone.now', return_value=next_time):
            series.name = 'Partial Save Series Updated'
            series.save(update_fields=['name'])
            self.assertEqual(series.updated_date, next_time)

        series.refresh_from_db()
        self.assertEqual(series.name, 'Partial Save Series Updated')
        self.assertEqual(series.updated_date, initial_time)

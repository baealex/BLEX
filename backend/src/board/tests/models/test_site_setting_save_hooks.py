from django.db import IntegrityError, transaction
from django.test import TestCase

from board.models import SiteSetting


class SiteSettingSaveHookTestCase(TestCase):
    """Characterization tests for SiteSetting singleton save behavior."""

    def setUp(self):
        SiteSetting.objects.all().delete()

    def test_save_forces_primary_key_to_one(self):
        setting = SiteSetting(header_script='header')

        setting.save()

        self.assertEqual(setting.pk, 1)
        self.assertEqual(SiteSetting.objects.count(), 1)
        self.assertEqual(SiteSetting.objects.get(pk=1).header_script, 'header')

    def test_save_with_explicit_primary_key_updates_singleton_key(self):
        setting = SiteSetting(pk=42, header_script='header')

        setting.save()

        self.assertEqual(setting.pk, 1)
        self.assertFalse(SiteSetting.objects.filter(pk=42).exists())
        self.assertEqual(SiteSetting.objects.get(pk=1).header_script, 'header')

    def test_saving_second_instance_updates_existing_singleton(self):
        SiteSetting.objects.create(header_script='first')
        setting = SiteSetting(pk=1, header_script='second')

        setting.save()

        self.assertEqual(SiteSetting.objects.count(), 1)
        self.assertEqual(SiteSetting.objects.get(pk=1).header_script, 'second')


    def test_saving_new_unsaved_instance_updates_existing_singleton(self):
        SiteSetting.objects.create(header_script='first')
        setting = SiteSetting(header_script='second')

        setting.save()

        self.assertEqual(setting.pk, 1)
        self.assertEqual(SiteSetting.objects.count(), 1)
        self.assertEqual(SiteSetting.objects.get(pk=1).header_script, 'second')

    def test_objects_create_second_instance_raises_integrity_error(self):
        SiteSetting.objects.create(header_script='first')

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                SiteSetting.objects.create(header_script='second')

        self.assertEqual(SiteSetting.objects.count(), 1)
        self.assertEqual(SiteSetting.objects.get(pk=1).header_script, 'first')

    def test_get_instance_creates_singleton_when_missing(self):
        setting = SiteSetting.get_instance()

        self.assertEqual(setting.pk, 1)
        self.assertEqual(SiteSetting.objects.count(), 1)

    def test_get_instance_returns_existing_singleton(self):
        existing = SiteSetting.objects.create(header_script='existing')

        setting = SiteSetting.get_instance()

        self.assertEqual(setting.pk, existing.pk)
        self.assertEqual(setting.header_script, 'existing')
        self.assertEqual(SiteSetting.objects.count(), 1)

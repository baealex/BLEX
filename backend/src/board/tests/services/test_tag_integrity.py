from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import TestCase

from board.models import Tag
from board.services.tag_service import TagService


class TagIntegrityTestCase(TestCase):
    def test_parse_tags_preserves_legacy_delimiters_and_normalization(self):
        self.assertEqual(
            TagService.parse_tags('Python,한글_tag'),
            {'python', '한글', 'tag'},
        )

    def test_parse_tags_preserves_default_tag(self):
        self.assertEqual(TagService.parse_tags(''), {'미분류'})

    def test_database_rejects_duplicate_value(self):
        Tag.objects.create(value='duplicate')

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Tag.objects.create(value='duplicate')

    def test_bulk_create_ignore_conflicts_uses_unique_constraint(self):
        Tag.objects.bulk_create(
            [Tag(value='conflict'), Tag(value='conflict')],
            ignore_conflicts=True,
        )

        self.assertEqual(Tag.objects.filter(value='conflict').count(), 1)

    def test_get_or_create_tags_recovers_from_concurrent_creation(self):
        original_bulk_create = Tag.objects.bulk_create

        def create_competing_tag(tags, **kwargs):
            Tag.objects.create(value='race')
            return original_bulk_create(tags, **kwargs)

        with patch.object(
            Tag.objects,
            'bulk_create',
            side_effect=create_competing_tag,
        ) as bulk_create:
            tags = TagService.get_or_create_tags({'race'})

        bulk_create.assert_called_once()
        self.assertEqual(tags['race'], Tag.objects.get(value='race'))
        self.assertEqual(Tag.objects.filter(value='race').count(), 1)

    def test_get_or_create_tags_preserves_unicode_values(self):
        tags = TagService.get_or_create_tags({'태그', 'タグ'})

        self.assertEqual(set(tags), {'태그', 'タグ'})
        self.assertEqual(set(Tag.objects.values_list('value', flat=True)), {'태그', 'タグ'})

    def test_case_variants_remain_distinct(self):
        tags = TagService.get_or_create_tags({'Python', 'python'})

        self.assertEqual(set(tags), {'Python', 'python'})
        self.assertEqual(Tag.objects.filter(value__in={'Python', 'python'}).count(), 2)

import logging

from django.db import migrations, models
from django.db.models import Count


logger = logging.getLogger(__name__)


def merge_duplicate_tags(apps, schema_editor):
    Tag = apps.get_model('board', 'Tag')
    Post = apps.get_model('board', 'Post')
    PostTag = Post.tags.through
    database = schema_editor.connection.alias

    duplicate_groups = list(
        Tag.objects.using(database)
        .values('value')
        .annotate(row_count=Count('id'))
        .filter(row_count__gt=1)
        .order_by('value')
    )

    removed_tag_count = 0
    transferred_link_count = 0
    for duplicate_group in duplicate_groups:
        tag_ids = list(
            Tag.objects.using(database)
            .filter(value=duplicate_group['value'])
            .order_by('pk')
            .values_list('pk', flat=True)
        )
        canonical_tag_id = tag_ids[0]
        duplicate_tag_ids = tag_ids[1:]

        source_post_ids = set(
            PostTag.objects.using(database)
            .filter(tag_id__in=duplicate_tag_ids)
            .values_list('post_id', flat=True)
        )
        canonical_post_ids = set(
            PostTag.objects.using(database)
            .filter(tag_id=canonical_tag_id, post_id__in=source_post_ids)
            .values_list('post_id', flat=True)
        )
        missing_post_ids = source_post_ids - canonical_post_ids
        PostTag.objects.using(database).bulk_create(
            [
                PostTag(post_id=post_id, tag_id=canonical_tag_id)
                for post_id in missing_post_ids
            ],
            ignore_conflicts=True,
        )
        transferred_link_count += len(missing_post_ids)

        Tag.objects.using(database).filter(pk__in=duplicate_tag_ids).delete()
        removed_tag_count += len(duplicate_tag_ids)

    logger.info(
        'Tag duplicate cleanup removed %s tag row(s) across %s value group(s) '
        'and transferred %s post link(s).',
        removed_tag_count,
        len(duplicate_groups),
        transferred_link_count,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0055_pinnedpost_unique_constraint'),
    ]

    operations = [
        migrations.RunPython(
            merge_duplicate_tags,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.RemoveIndex(
            model_name='tag',
            name='board_tag_value_caa644_idx',
        ),
        migrations.AddConstraint(
            model_name='tag',
            constraint=models.UniqueConstraint(
                fields=('value',),
                name='board_tag_value_uniq',
            ),
        ),
    ]

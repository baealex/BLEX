import logging

from django.db import migrations, models
from django.db.models import Count


logger = logging.getLogger(__name__)


def merge_duplicate_pinned_posts(apps, schema_editor):
    PinnedPost = apps.get_model('board', 'PinnedPost')
    duplicate_groups = list(
        PinnedPost.objects.values('user_id', 'post_id')
        .annotate(row_count=Count('id'))
        .filter(row_count__gt=1)
        .order_by('user_id', 'post_id')
    )
    affected_user_ids = sorted({group['user_id'] for group in duplicate_groups})

    removed_count = 0
    for duplicate in duplicate_groups:
        group = PinnedPost.objects.filter(
            user_id=duplicate['user_id'],
            post_id=duplicate['post_id'],
        ).order_by('order', 'created_date', 'pk')
        keep_id = group.values_list('pk', flat=True).first()
        deleted_count, _ = group.exclude(pk=keep_id).delete()
        removed_count += deleted_count

    reordered_count = 0
    for user_id in affected_user_ids:
        remaining = PinnedPost.objects.filter(user_id=user_id).order_by(
            'order',
            'created_date',
            'pk',
        )
        for next_order, pinned_post in enumerate(remaining.iterator()):
            if pinned_post.order != next_order:
                PinnedPost.objects.filter(pk=pinned_post.pk).update(order=next_order)
                reordered_count += 1

    logger.info(
        'PinnedPost duplicate cleanup removed %s row(s) across %s group(s) and '
        'reordered %s row(s) for %s user(s).',
        removed_count,
        len(duplicate_groups),
        reordered_count,
        len(affected_user_ids),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0054_postlikes_unique_constraint'),
    ]

    operations = [
        migrations.RunPython(
            merge_duplicate_pinned_posts,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name='pinnedpost',
            constraint=models.UniqueConstraint(
                fields=('user', 'post'),
                name='board_pinned_user_post_uniq',
            ),
        ),
    ]

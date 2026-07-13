import logging

from django.db import migrations, models
from django.db.models import Count


logger = logging.getLogger(__name__)


def merge_duplicate_post_likes(apps, schema_editor):
    PostLikes = apps.get_model('board', 'PostLikes')
    duplicate_groups = list(
        PostLikes.objects.values('post_id', 'user_id')
        .annotate(row_count=Count('id'))
        .filter(row_count__gt=1)
        .order_by('post_id', 'user_id')
    )
    duplicate_group_count = len(duplicate_groups)

    removed_count = 0
    for duplicate in duplicate_groups:
        group = PostLikes.objects.filter(
            post_id=duplicate['post_id'],
            user_id=duplicate['user_id'],
        ).order_by('created_date', 'pk')
        keep_id = group.values_list('pk', flat=True).first()
        deleted_count, _ = group.exclude(pk=keep_id).delete()
        removed_count += deleted_count

    logger.info(
        'PostLikes duplicate cleanup removed %s row(s) across %s group(s).',
        removed_count,
        duplicate_group_count,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0053_encrypt_two_factor_auth_secrets'),
    ]

    operations = [
        migrations.RunPython(
            merge_duplicate_post_likes,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name='postlikes',
            constraint=models.UniqueConstraint(
                fields=('post', 'user'),
                name='board_postlike_post_user_uniq',
            ),
        ),
    ]

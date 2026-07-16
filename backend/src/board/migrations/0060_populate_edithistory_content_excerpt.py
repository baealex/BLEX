from html import unescape

from django.db import migrations, transaction
from django.template.defaultfilters import truncatechars
from django.utils.html import strip_tags


BATCH_SIZE = 500


def populate_content_excerpts(apps, schema_editor):
    EditHistory = apps.get_model('board', 'EditHistory')
    database_alias = schema_editor.connection.alias
    last_pk = 0
    while True:
        histories = list(
            EditHistory.objects.using(database_alias).filter(pk__gt=last_pk)
            .only('id', 'content')
            .order_by('pk')[:BATCH_SIZE]
        )
        if not histories:
            break
        for history in histories:
            content_text = unescape(strip_tags(history.content)).strip()
            history.content_excerpt = truncatechars(content_text, 160)
        with transaction.atomic(using=database_alias):
            EditHistory.objects.using(database_alias).bulk_update(
                histories,
                ['content_excerpt'],
            )
        last_pk = histories[-1].pk


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('board', '0059_edithistory_content_excerpt'),
    ]

    operations = [
        migrations.RunPython(populate_content_excerpts, migrations.RunPython.noop),
    ]

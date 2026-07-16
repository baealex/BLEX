from html import unescape

from django.db import migrations, models
from django.template.defaultfilters import truncatechars
from django.utils.html import strip_tags


def populate_content_excerpts(apps, schema_editor):
    EditHistory = apps.get_model('board', 'EditHistory')
    pending = []
    for history in EditHistory.objects.only('id', 'content').iterator(chunk_size=500):
        content_text = unescape(strip_tags(history.content)).strip()
        history.content_excerpt = truncatechars(content_text, 160)
        pending.append(history)
        if len(pending) == 500:
            EditHistory.objects.bulk_update(pending, ['content_excerpt'])
            pending.clear()
    if pending:
        EditHistory.objects.bulk_update(pending, ['content_excerpt'])


class Migration(migrations.Migration):
    dependencies = [
        ('board', '0059_site_content_list_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='edithistory',
            name='content_excerpt',
            field=models.CharField(blank=True, default='', max_length=160),
        ),
        migrations.RunPython(populate_content_excerpts, migrations.RunPython.noop),
    ]

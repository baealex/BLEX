from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0044_merge_developer_api_and_runtime_robots'),
    ]

    operations = [
        migrations.RenameField(
            model_name='postcontent',
            old_name='text_html',
            new_name='content_html',
        ),
        migrations.RemoveField(
            model_name='postcontent',
            name='text_md',
        ),
        migrations.RemoveField(
            model_name='postcontent',
            name='content_type',
        ),
    ]

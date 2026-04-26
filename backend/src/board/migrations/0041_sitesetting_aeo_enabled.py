from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0040_migrate_content_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesetting',
            name='aeo_enabled',
            field=models.BooleanField(
                default=False,
                help_text='AI 에이전트용 llms.txt, Markdown endpoint, discovery header 노출 여부',
            ),
        ),
    ]

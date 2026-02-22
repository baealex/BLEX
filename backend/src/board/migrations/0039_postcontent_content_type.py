from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0038_webhooksubscription_global_channel'),
    ]

    operations = [
        migrations.AddField(
            model_name='postcontent',
            name='content_type',
            field=models.CharField(
                choices=[('html', 'HTML'), ('markdown', 'Markdown')],
                default='html',
                max_length=10,
            ),
        ),
    ]

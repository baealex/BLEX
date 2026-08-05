from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0063_localize_model_metadata'),
    ]

    operations = [
        migrations.AddField(
            model_name='notify',
            name='message_key',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='notify',
            name='message_params',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

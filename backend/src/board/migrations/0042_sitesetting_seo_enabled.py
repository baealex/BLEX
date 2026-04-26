from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0041_sitesetting_aeo_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesetting',
            name='seo_enabled',
            field=models.BooleanField(
                default=True,
                help_text='검색엔진용 robots.txt 색인 허용 및 HTML noindex 신호 제어 여부',
            ),
        ),
    ]

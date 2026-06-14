from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0051_loginsetting'),
    ]

    operations = [
        migrations.CreateModel(
            name='IntegrationSetting',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('telegram_enabled', models.BooleanField(default=False, help_text='텔레그램 봇 연동 사용 여부')),
                ('telegram_bot_username', models.CharField(blank=True, default='', help_text='사용자에게 안내할 텔레그램 봇 사용자명', max_length=64)),
                ('telegram_bot_token', models.TextField(blank=True, default='', help_text='암호화 저장되는 텔레그램 봇 토큰')),
                ('updated_date', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': '🏢 [사이트 운영] 텔레그램',
                'verbose_name_plural': '🏢 [사이트 운영] 텔레그램',
            },
        ),
    ]

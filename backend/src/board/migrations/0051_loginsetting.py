from django.db import migrations, models


def migrate_site_login_settings(apps, schema_editor):
    SiteSetting = apps.get_model('board', 'SiteSetting')
    LoginSetting = apps.get_model('board', 'LoginSetting')

    site_setting = SiteSetting.objects.filter(pk=1).first()
    if site_setting is None:
        LoginSetting.objects.get_or_create(pk=1)
        return

    LoginSetting.objects.update_or_create(
        pk=1,
        defaults={
            'welcome_notification_message': site_setting.welcome_notification_message,
            'welcome_notification_url': site_setting.welcome_notification_url,
            'account_deletion_redirect_url': site_setting.account_deletion_redirect_url,
        },
    )


def restore_site_login_settings(apps, schema_editor):
    SiteSetting = apps.get_model('board', 'SiteSetting')
    LoginSetting = apps.get_model('board', 'LoginSetting')

    login_setting = LoginSetting.objects.filter(pk=1).first()
    if login_setting is None:
        return

    SiteSetting.objects.update_or_create(
        pk=1,
        defaults={
            'welcome_notification_message': login_setting.welcome_notification_message,
            'welcome_notification_url': login_setting.welcome_notification_url,
            'account_deletion_redirect_url': login_setting.account_deletion_redirect_url,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0050_socialauthprovider_credentials'),
    ]

    operations = [
        migrations.CreateModel(
            name='LoginSetting',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('welcome_notification_message', models.TextField(blank=True, default='', help_text='회원가입 시 발송될 환영 알림 메시지 ({name}을 사용하여 사용자 이름 삽입 가능)')),
                ('welcome_notification_url', models.CharField(blank=True, default='/', help_text='회원가입 알림 클릭 시 이동할 URL', max_length=255)),
                ('account_deletion_redirect_url', models.CharField(blank=True, default='', help_text='회원 탈퇴 시 리다이렉트할 URL (비워두면 메인 페이지로 이동, 설문 링크 등을 설정할 수 있습니다)', max_length=500)),
                ('hcaptcha_enabled', models.BooleanField(default=False, help_text='회원가입 hCaptcha 검증 사용 여부')),
                ('hcaptcha_site_key', models.CharField(blank=True, default='', help_text='hCaptcha Site Key', max_length=255)),
                ('hcaptcha_secret_key', models.TextField(blank=True, default='', help_text='암호화 저장되는 hCaptcha Secret Key')),
                ('updated_date', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': '🏢 [사이트 운영] 로그인 설정',
                'verbose_name_plural': '🏢 [사이트 운영] 로그인 설정',
            },
        ),
        migrations.RunPython(migrate_site_login_settings, restore_site_login_settings),
        migrations.RemoveField(
            model_name='sitesetting',
            name='welcome_notification_message',
        ),
        migrations.RemoveField(
            model_name='sitesetting',
            name='welcome_notification_url',
        ),
        migrations.RemoveField(
            model_name='sitesetting',
            name='account_deletion_redirect_url',
        ),
    ]

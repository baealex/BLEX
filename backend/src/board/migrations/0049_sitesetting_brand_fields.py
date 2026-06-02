from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0048_postconfig_cover_image_position_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesetting',
            name='site_name',
            field=models.CharField(blank=True, default='BLEX', help_text='사이트 공식 이름', max_length=80),
        ),
        migrations.AddField(
            model_name='sitesetting',
            name='logo_svg',
            field=models.FileField(blank=True, upload_to='brand/logo/default/'),
        ),
        migrations.AddField(
            model_name='sitesetting',
            name='logo_svg_dark',
            field=models.FileField(blank=True, upload_to='brand/logo/dark/'),
        ),
        migrations.AddField(
            model_name='sitesetting',
            name='icon_svg',
            field=models.FileField(blank=True, upload_to='brand/icon/default/'),
        ),
        migrations.AddField(
            model_name='sitesetting',
            name='icon_svg_dark',
            field=models.FileField(blank=True, upload_to='brand/icon/dark/'),
        ),
        migrations.AddField(
            model_name='sitesetting',
            name='icon_manifest',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

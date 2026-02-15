"""Create SiteNotice and SiteBanner models (keeping old models temporarily)"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0031_remove_utilityproxy'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SiteNotice',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scope', models.CharField(choices=[('user', '사용자'), ('global', '전역')], max_length=10)),
                ('title', models.CharField(max_length=200)),
                ('is_active', models.BooleanField(default=True)),
                ('order', models.IntegerField(default=0)),
                ('created_date', models.DateTimeField(auto_now_add=True)),
                ('updated_date', models.DateTimeField(auto_now=True)),
                ('url', models.CharField(blank=True, default='', max_length=255)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['order', '-created_date'],
                'abstract': False,
                'indexes': [
                    models.Index(fields=['scope', 'is_active'], name='board_siten_scope_0b3bc6_idx'),
                    models.Index(fields=['user', 'is_active'], name='board_siten_user_id_2b60d0_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='SiteBanner',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scope', models.CharField(choices=[('user', '사용자'), ('global', '전역')], max_length=10)),
                ('title', models.CharField(max_length=200)),
                ('is_active', models.BooleanField(default=True)),
                ('order', models.IntegerField(default=0)),
                ('created_date', models.DateTimeField(auto_now_add=True)),
                ('updated_date', models.DateTimeField(auto_now=True)),
                ('content_html', models.TextField(blank=True, default='')),
                ('banner_type', models.CharField(choices=[('horizontal', '줄배너 (가로 전체)'), ('sidebar', '사이드배너 (좌우 측면)')], default='horizontal', max_length=20)),
                ('position', models.CharField(choices=[('top', '상단'), ('bottom', '하단'), ('left', '좌측'), ('right', '우측')], default='top', max_length=10)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['order', '-created_date'],
                'abstract': False,
                'indexes': [
                    models.Index(fields=['scope', 'is_active', 'banner_type', 'position'], name='board_siteb_scope_774e20_idx'),
                    models.Index(fields=['user', 'is_active'], name='board_siteb_user_id_7efe4d_idx'),
                ],
            },
        ),
    ]

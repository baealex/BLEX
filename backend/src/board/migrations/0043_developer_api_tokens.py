import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0042_sitesetting_seo_enabled'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeveloperToken',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('token_prefix', models.CharField(max_length=16, unique=True)),
                ('token_hash', models.CharField(max_length=64, unique=True)),
                ('scopes', models.JSONField(default=list)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('last_used_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('created_date', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_date', models.DateTimeField(default=django.utils.timezone.now)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='developer_tokens', to='auth.user')),
            ],
            options={
                'ordering': ['-created_date'],
                'indexes': [
                    models.Index(fields=['user', 'revoked_at'], name='board_devel_user_id_bf372b_idx'),
                    models.Index(fields=['token_prefix'], name='board_devel_token_p_7a12b4_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='DeveloperRequestLog',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('method', models.CharField(max_length=10)),
                ('path', models.CharField(max_length=255)),
                ('status_code', models.PositiveSmallIntegerField()),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=255)),
                ('created_date', models.DateTimeField(default=django.utils.timezone.now)),
                ('token', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='request_logs', to='board.developertoken')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='developer_request_logs', to='auth.user')),
            ],
            options={
                'ordering': ['-created_date'],
                'indexes': [
                    models.Index(fields=['user', 'created_date'], name='board_devel_user_id_e88d8c_idx'),
                    models.Index(fields=['token', 'created_date'], name='board_devel_token_i_fbbd82_idx'),
                ],
            },
        ),
    ]

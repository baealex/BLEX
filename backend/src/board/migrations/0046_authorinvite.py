from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('board', '0045_postcontent_content_html_ssot'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuthorInvite',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=64, unique=True)),
                ('note', models.CharField(blank=True, default='', max_length=120)),
                ('is_active', models.BooleanField(default=True)),
                ('created_date', models.DateTimeField(default=django.utils.timezone.now)),
                ('claimed_date', models.DateTimeField(blank=True, null=True)),
                ('claimed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='author_invites_claimed', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='author_invites_created', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_date'],
                'indexes': [
                    models.Index(fields=['code', 'is_active'], name='board_autho_code_e7ed63_idx'),
                    models.Index(fields=['claimed_by'], name='board_autho_claimed_0188bf_idx'),
                ],
            },
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('board', '0058_post_deleted_date'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='sitenotice',
            index=models.Index(
                fields=['scope', '-created_date'],
                name='board_siten_scope_c_7e9e28_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='sitenotice',
            index=models.Index(
                fields=['user', '-created_date'],
                name='board_siten_user_id_f9a0e5_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='sitebanner',
            index=models.Index(
                fields=['scope', 'order', '-created_date'],
                name='board_siteb_scope_o_c9485c_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='sitebanner',
            index=models.Index(
                fields=['user', 'order', '-created_date'],
                name='board_siteb_user_id_973b24_idx',
            ),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('board', '0058_post_deleted_date'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE "board_edithistory" '
                        'ADD COLUMN "content_excerpt" varchar(160) NULL'
                    ),
                    reverse_sql=(
                        'ALTER TABLE "board_edithistory" '
                        'DROP COLUMN "content_excerpt"'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='edithistory',
                    name='content_excerpt',
                    field=models.CharField(
                        blank=True,
                        default='',
                        max_length=160,
                        null=True,
                    ),
                ),
            ],
        ),
    ]

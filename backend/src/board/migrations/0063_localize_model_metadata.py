from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0062_utilitycleanupconfirmation'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # Labels and help text belong to Django's historical model state;
            # they do not require database schema changes.
            database_operations=[],
            state_operations=[
                migrations.AlterModelOptions(
                    name='integrationsetting',
                    options={
                        'verbose_name': '🏢 [Site operations] Telegram',
                        'verbose_name_plural': '🏢 [Site operations] Telegram',
                    },
                ),
                migrations.AlterModelOptions(
                    name='loginsetting',
                    options={
                        'verbose_name': '🏢 [Site operations] Login settings',
                        'verbose_name_plural': '🏢 [Site operations] Login settings',
                    },
                ),
                migrations.AlterModelOptions(
                    name='sitesetting',
                    options={
                        'verbose_name': '🏢 [Site operations] Site settings',
                        'verbose_name_plural': '🏢 [Site operations] Site settings',
                    },
                ),
                migrations.AlterModelOptions(
                    name='staticpage',
                    options={
                        'ordering': ['order', 'slug'],
                        'verbose_name': '🏢 [Site operations] Static pages',
                        'verbose_name_plural': '🏢 [Site operations] Static pages',
                    },
                ),
                migrations.AlterField(
                    model_name='edithistory',
                    name='change_type',
                    field=models.CharField(
                        choices=[
                            ('edit', 'Before edit'),
                            ('restore', 'Before restore'),
                            ('legacy', 'Legacy'),
                        ],
                        default='legacy',
                        max_length=16,
                    ),
                ),
                migrations.AlterField(
                    model_name='postconfig',
                    name='cover_image_position',
                    field=models.CharField(
                        choices=[('right', 'Right'), ('left', 'Left')],
                        default='right',
                        max_length=8,
                    ),
                ),
                migrations.AlterField(
                    model_name='postconfig',
                    name='cover_image_ratio',
                    field=models.CharField(
                        choices=[
                            ('auto', 'Original'),
                            ('16:9', '16:9'),
                            ('4:3', '4:3'),
                            ('1:1', '1:1'),
                            ('3:4', '3:4'),
                        ],
                        default='auto',
                        max_length=8,
                    ),
                ),
                migrations.AlterField(
                    model_name='postconfig',
                    name='cover_layout',
                    field=models.CharField(
                        choices=[
                            ('default', 'Default'),
                            ('split', 'Split'),
                            ('overlay', 'Image background'),
                            ('none', 'Hide cover'),
                        ],
                        default='default',
                        max_length=16,
                    ),
                ),
                migrations.AlterField(
                    model_name='sitebanner',
                    name='banner_type',
                    field=models.CharField(
                        choices=[
                            ('horizontal', 'Full-width banner (horizontal)'),
                            ('sidebar', 'Side banner (left/right)'),
                        ],
                        default='horizontal',
                        max_length=20,
                    ),
                ),
                migrations.AlterField(
                    model_name='sitebanner',
                    name='position',
                    field=models.CharField(
                        choices=[
                            ('top', 'Top'),
                            ('bottom', 'Bottom'),
                            ('left', 'Left'),
                            ('right', 'Right'),
                        ],
                        default='top',
                        max_length=10,
                    ),
                ),
                migrations.AlterField(
                    model_name='sitebanner',
                    name='scope',
                    field=models.CharField(
                        choices=[('user', 'User'), ('global', 'Global')],
                        max_length=10,
                    ),
                ),
                migrations.AlterField(
                    model_name='sitenotice',
                    name='scope',
                    field=models.CharField(
                        choices=[('user', 'User'), ('global', 'Global')],
                        max_length=10,
                    ),
                ),
                migrations.AlterField(
                    model_name='webhooksubscription',
                    name='scope',
                    field=models.CharField(
                        choices=[('user', 'User'), ('global', 'Global')],
                        default='user',
                        max_length=10,
                    ),
                ),
                migrations.AlterField(
                    model_name='profile',
                    name='analytics_share_url',
                    field=models.URLField(
                        blank=True,
                        help_text=(
                            'Analytics sharing URL (for example, Umami or '
                            'Google Analytics)'
                        ),
                        max_length=500,
                    ),
                ),
                migrations.AlterField(
                    model_name='profile',
                    name='role',
                    field=models.CharField(
                        choices=[('READER', 'Reader'), ('EDITOR', 'Author')],
                        default='READER',
                        help_text=(
                            'User role (Reader: read only; Author: write posts '
                            'and view analytics)'
                        ),
                        max_length=10,
                    ),
                ),
                migrations.AlterField(
                    model_name='integrationsetting',
                    name='telegram_bot_token',
                    field=models.TextField(
                        blank=True,
                        default='',
                        help_text='Encrypted Telegram bot token.',
                    ),
                ),
                migrations.AlterField(
                    model_name='integrationsetting',
                    name='telegram_bot_username',
                    field=models.CharField(
                        blank=True,
                        default='',
                        help_text='Telegram bot username shown to users.',
                        max_length=64,
                    ),
                ),
                migrations.AlterField(
                    model_name='integrationsetting',
                    name='telegram_enabled',
                    field=models.BooleanField(
                        default=False,
                        help_text='Enable Telegram bot integration.',
                    ),
                ),
                migrations.AlterField(
                    model_name='loginsetting',
                    name='account_deletion_redirect_url',
                    field=models.CharField(
                        blank=True,
                        default='',
                        help_text=(
                            'Redirect URL after account deletion. Leave blank '
                            'to use the home page.'
                        ),
                        max_length=500,
                    ),
                ),
                migrations.AlterField(
                    model_name='loginsetting',
                    name='hcaptcha_enabled',
                    field=models.BooleanField(
                        default=False,
                        help_text='Require hCaptcha verification during signup.',
                    ),
                ),
                migrations.AlterField(
                    model_name='loginsetting',
                    name='hcaptcha_secret_key',
                    field=models.TextField(
                        blank=True,
                        default='',
                        help_text='Encrypted hCaptcha Secret Key.',
                    ),
                ),
                migrations.AlterField(
                    model_name='loginsetting',
                    name='welcome_notification_message',
                    field=models.TextField(
                        blank=True,
                        default='',
                        help_text=(
                            'Welcome notification sent after signup. Use '
                            "{name} to insert the user's name."
                        ),
                    ),
                ),
                migrations.AlterField(
                    model_name='loginsetting',
                    name='welcome_notification_url',
                    field=models.CharField(
                        blank=True,
                        default='/',
                        help_text='URL opened from the signup notification.',
                        max_length=255,
                    ),
                ),
                migrations.AlterField(
                    model_name='sitesetting',
                    name='aeo_enabled',
                    field=models.BooleanField(
                        default=False,
                        help_text=(
                            'Expose llms.txt, Markdown endpoints, and discovery '
                            'headers for AI agents.'
                        ),
                    ),
                ),
                migrations.AlterField(
                    model_name='sitesetting',
                    name='footer_script',
                    field=models.TextField(
                        blank=True,
                        help_text=(
                            'Script inserted before the closing </body> tag.'
                        ),
                    ),
                ),
                migrations.AlterField(
                    model_name='sitesetting',
                    name='header_script',
                    field=models.TextField(
                        blank=True,
                        help_text=(
                            'Script inserted inside the <head> element (for '
                            'example, Google Analytics or Umami).'
                        ),
                    ),
                ),
                migrations.AlterField(
                    model_name='sitesetting',
                    name='robots_txt_extra_rules',
                    field=models.TextField(
                        blank=True,
                        default='',
                        help_text=(
                            "Additional runtime rules appended after the blog's "
                            'default robots.txt policy.'
                        ),
                    ),
                ),
                migrations.AlterField(
                    model_name='sitesetting',
                    name='seo_enabled',
                    field=models.BooleanField(
                        default=True,
                        help_text=(
                            'Allow search-engine indexing through robots.txt '
                            'and HTML noindex signals.'
                        ),
                    ),
                ),
                migrations.AlterField(
                    model_name='sitesetting',
                    name='site_name',
                    field=models.CharField(
                        blank=True,
                        default='BLEX',
                        help_text='Official site name.',
                        max_length=80,
                    ),
                ),
                migrations.AlterField(
                    model_name='staticpage',
                    name='content',
                    field=models.TextField(
                        help_text='Page content. HTML is supported.',
                    ),
                ),
                migrations.AlterField(
                    model_name='staticpage',
                    name='is_published',
                    field=models.BooleanField(
                        default=True,
                        help_text='Whether the page is public.',
                    ),
                ),
                migrations.AlterField(
                    model_name='staticpage',
                    name='meta_description',
                    field=models.CharField(
                        blank=True,
                        help_text='SEO meta description (up to 160 characters).',
                        max_length=160,
                    ),
                ),
                migrations.AlterField(
                    model_name='staticpage',
                    name='order',
                    field=models.IntegerField(
                        default=0,
                        help_text='Sort order. Lower numbers appear first.',
                    ),
                ),
                migrations.AlterField(
                    model_name='staticpage',
                    name='show_in_footer',
                    field=models.BooleanField(
                        default=False,
                        help_text='Show a link in the footer.',
                    ),
                ),
                migrations.AlterField(
                    model_name='staticpage',
                    name='slug',
                    field=models.SlugField(
                        allow_unicode=True,
                        help_text=(
                            'URL path (for example, about, privacy, or terms).'
                        ),
                        max_length=100,
                        unique=True,
                    ),
                ),
                migrations.AlterField(
                    model_name='staticpage',
                    name='title',
                    field=models.CharField(
                        help_text='Page title.',
                        max_length=200,
                    ),
                ),
            ],
        ),
    ]

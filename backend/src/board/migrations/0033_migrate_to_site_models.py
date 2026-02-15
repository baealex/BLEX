"""Migrate data from GlobalNotice/Banner/GlobalBanner to SiteNotice/SiteBanner"""
from django.db import migrations


def migrate_data_forward(apps, schema_editor):
    GlobalNotice = apps.get_model('board', 'GlobalNotice')
    Banner = apps.get_model('board', 'Banner')
    GlobalBanner = apps.get_model('board', 'GlobalBanner')
    SiteNotice = apps.get_model('board', 'SiteNotice')
    SiteBanner = apps.get_model('board', 'SiteBanner')

    # GlobalNotice -> SiteNotice (scope=global)
    for notice in GlobalNotice.objects.all():
        SiteNotice.objects.create(
            scope='global',
            user=None,
            title=notice.title,
            url=notice.url,
            is_active=notice.is_active,
            order=0,
        )

    # Banner -> SiteBanner (scope=user)
    for banner in Banner.objects.all():
        SiteBanner.objects.create(
            scope='user',
            user=banner.user,
            title=banner.title,
            content_html=banner.content_html,
            banner_type=banner.banner_type,
            position=banner.position,
            is_active=banner.is_active,
            order=banner.order,
        )

    # GlobalBanner -> SiteBanner (scope=global)
    for banner in GlobalBanner.objects.all():
        SiteBanner.objects.create(
            scope='global',
            user=banner.created_by,
            title=banner.title,
            content_html=banner.content_html,
            banner_type=banner.banner_type,
            position=banner.position,
            is_active=banner.is_active,
            order=banner.order,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0032_sitenotice_sitebanner'),
    ]

    operations = [
        migrations.RunPython(migrate_data_forward, migrations.RunPython.noop),
    ]

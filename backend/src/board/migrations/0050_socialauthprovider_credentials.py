from django.db import migrations, models

from board.services.social_auth_provider_secret_service import SocialAuthProviderSecretService


SUPPORTED_PROVIDER_NAMES = {
    'google': 'Google',
    'github': 'GitHub',
}


def create_supported_social_providers(apps, schema_editor):
    SocialAuthProvider = apps.get_model('board', 'SocialAuthProvider')
    for key in SUPPORTED_PROVIDER_NAMES:
        SocialAuthProvider.objects.get_or_create(
            key=key,
            defaults={
                'is_enabled': False,
            },
        )

def encrypt_existing_client_secrets(apps, schema_editor):
    SocialAuthProvider = apps.get_model('board', 'SocialAuthProvider')
    for provider in SocialAuthProvider.objects.exclude(client_secret=''):
        encrypted_secret = SocialAuthProviderSecretService.encrypt_secret(provider.client_secret)
        if encrypted_secret != provider.client_secret:
            provider.client_secret = encrypted_secret
            provider.save(update_fields=['client_secret'])


def migrate_legacy_last_name_social_auth(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    SocialAuth = apps.get_model('board', 'SocialAuth')
    SocialAuthProvider = apps.get_model('board', 'SocialAuthProvider')

    provider_map = {
        key: SocialAuthProvider.objects.get_or_create(key=key)[0]
        for key in SUPPORTED_PROVIDER_NAMES
    }

    seen = set()
    owner_by_key = {}
    for social_auth in SocialAuth.objects.order_by('id'):
        key = (social_auth.provider_id, social_auth.uid)
        if key in seen:
            if owner_by_key[key] == social_auth.user_id:
                social_auth.delete()
                continue
            raise RuntimeError(
                'Duplicate SocialAuth provider/uid points to multiple users. '
                'Resolve duplicate social auth rows before applying migration.'
            )
            continue
        seen.add(key)
        owner_by_key[key] = social_auth.user_id

    for user in User.objects.exclude(last_name=''):
        provider_key, separator, uid = user.last_name.partition(':')
        if separator != ':' or provider_key not in provider_map or not uid:
            continue

        social_auth, created = SocialAuth.objects.get_or_create(
            provider=provider_map[provider_key],
            uid=uid,
            defaults={
                'user': user,
                'extra_data': '{}',
            },
        )
        if not created and social_auth.user_id != user.id:
            continue
        user.last_name = ''
        user.save(update_fields=['last_name'])


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0049_sitesetting_brand_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='socialauthprovider',
            name='client_id',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='socialauthprovider',
            name='client_secret',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='socialauthprovider',
            name='is_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.RemoveField(
            model_name='socialauthprovider',
            name='color',
        ),
        migrations.RemoveField(
            model_name='socialauthprovider',
            name='icon',
        ),
        migrations.RemoveField(
            model_name='socialauthprovider',
            name='name',
        ),
        migrations.AlterField(
            model_name='socialauthprovider',
            name='key',
            field=models.CharField(
                choices=[
                    ('google', 'Google'),
                    ('github', 'GitHub'),
                ],
                max_length=20,
                unique=True,
            ),
        ),
        migrations.RunPython(create_supported_social_providers, migrations.RunPython.noop),
        migrations.RunPython(encrypt_existing_client_secrets, migrations.RunPython.noop),
        migrations.RunPython(migrate_legacy_last_name_social_auth, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='socialauth',
            constraint=models.UniqueConstraint(
                fields=('provider', 'uid'),
                name='unique_social_auth_provider_uid',
            ),
        ),
    ]

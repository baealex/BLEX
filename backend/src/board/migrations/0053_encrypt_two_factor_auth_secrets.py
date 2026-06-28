import hashlib
import re

from django.db import migrations, models

from modules.cipher import decrypt_value, encrypt_value


SHA256_HEX_PATTERN = re.compile(r'^[0-9a-f]{64}$')


def is_encrypted(value):
    if not value:
        return False
    try:
        decrypt_value(value)
        return True
    except Exception:
        return False


def encrypt_totp_secret(value):
    value = (value or '').strip()
    if not value or is_encrypted(value):
        return value
    return encrypt_value(value).decode()


def is_recovery_key_hash(value):
    return bool(SHA256_HEX_PATTERN.fullmatch((value or '').strip()))


def hash_recovery_key(value):
    return hashlib.sha256((value or '').strip().encode('utf-8')).hexdigest()


def protect_recovery_key(value):
    value = (value or '').strip()
    if not value or is_recovery_key_hash(value):
        return value
    return hash_recovery_key(value)


def protect_existing_two_factor_auth_secrets(apps, schema_editor):
    TwoFactorAuth = apps.get_model('board', 'TwoFactorAuth')
    for two_factor_auth in TwoFactorAuth.objects.all().iterator():
        update_fields = []

        totp_secret = encrypt_totp_secret(two_factor_auth.totp_secret)
        if totp_secret != two_factor_auth.totp_secret:
            two_factor_auth.totp_secret = totp_secret
            update_fields.append('totp_secret')

        recovery_key = protect_recovery_key(two_factor_auth.recovery_key)
        if recovery_key != two_factor_auth.recovery_key:
            two_factor_auth.recovery_key = recovery_key
            update_fields.append('recovery_key')

        if update_fields:
            two_factor_auth.save(update_fields=update_fields)


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0052_integrationsetting'),
    ]

    operations = [
        migrations.AlterField(
            model_name='twofactorauth',
            name='recovery_key',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AlterField(
            model_name='twofactorauth',
            name='totp_secret',
            field=models.TextField(blank=True),
        ),
        migrations.RunPython(protect_existing_two_factor_auth_secrets),
    ]

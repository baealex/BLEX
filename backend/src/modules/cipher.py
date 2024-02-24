import base64

from cryptography.fernet import Fernet

from django.conf import settings


key = base64.urlsafe_b64encode(settings.CIPHER_KEY)

def encrypt_value(value) -> bytes:
    return Fernet(key).encrypt(value.encode())

def decrypt_value(value) -> str:
    return Fernet(key).decrypt(value).decode()

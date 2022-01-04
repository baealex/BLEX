import base64
import hashlib

from typing import Union

def get_hash(method, data: Union[str, bytes]) -> str:
    if 'str' in str(type(data)):
        data = data.encode()
    if not 'bytes' in str(type(data)):
        raise Exception('data is not string or bytes.')
    return base64.b64encode(method(data).digest()).decode()

def get_md5(data: Union[str, bytes]) -> str:
    return get_hash(hashlib.md5, data)

def get_sha256(data: Union[str, bytes]) -> str:
    return get_hash(hashlib.sha256, data)

def get_sha512(data: Union[str, bytes]) -> str:
    return get_hash(hashlib.sha512, data)

if __name__ == '__main__':
    text = 'baealex'
    print('baealex md5 hash :', get_md5(text))
    print('baealex sha256 hash :', get_sha256(text))
    print('baealex sha512 hash :', get_sha512(text))

    print('========================')

    text_bytes = 'baejino'.encode()
    print('baejino md5 hash :', get_md5(text_bytes))
    print('baejino sha256 hash :', get_sha256(text_bytes))
    print('baejino sha512 hash :', get_sha512(text_bytes))
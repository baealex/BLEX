import base64
import hashlib

def get_hash(method, data):
    if 'str' in str(type(data)):
        data = data.encode()
    if not 'bytes' in str(type(data)):
        raise Exception('data is not string or bytes.')
    return base64.b64encode(method(data).digest()).decode()

def get_md5(data):
    return get_hash(hashlib.md5, data)

def get_sha256(data):
    return get_hash(hashlib.sha256, data)

def get_sha512(data):
    return get_hash(hashlib.sha512, data)

if __name__ == '__main__':
    text = 'baealex'
    print('md5 hash :', get_md5(text))
    print('sha256 hash :', get_sha256(text))
    print('sha512 hash :', get_sha512(text))
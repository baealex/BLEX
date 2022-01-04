import random

from typing import Union

def randpick(items: Union[str, list], length: int):
    items_len = len(items) - 1

    result = ''
    for i in range(length):
        result += str(items[random.randint(0, items_len)])
    return result

def randnum(length: int):
    return randpick('0123456789', length)

def randstr(length: int):
    return randpick('0123456789abcdefghijklnmopqrstuvwxyzABCDEFGHIJKLNMOPQRSTUVWXYZ', length)

if __name__ == '__main__':
    print('randpick', randpick([0, 1], 10))
    print('randpick', randpick('!@#$%^&*()', 10))
    print('randnum', randnum(10))
    print('randstr', randstr(20))
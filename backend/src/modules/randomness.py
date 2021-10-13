import random

def random_pick_char(pick_char, length):
    pick_char_len = len(pick_char) - 1

    result = ''
    for i in range(length):
        result += pick_char[random.randint(0, pick_char_len)]
    return result

def randnum(length):
    return random_pick_char('0123456789', length)

def randstr(length):
    return random_pick_char('0123456789abcdefghijklnmopqrstuvwxyzABCDEFGHIJKLNMOPQRSTUVWXYZ', length)

if __name__ == '__main__':
    print(randnum(10))
    print(randstr(20))
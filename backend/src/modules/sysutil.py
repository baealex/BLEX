import os
import sys


def make_path(dir_list):
    upload_path = ''
    for dir_name in dir_list:
        upload_path += dir_name + '/'
        if not os.path.exists(upload_path):
            os.makedirs(upload_path)
    return upload_path


def flush_print(*args, **kwargs):
    print(*args, **kwargs)
    sys.stdout.flush()

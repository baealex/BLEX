import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post

datas = Post.objects.all()

if __name__ == '__main__':
    for data in datas:
        if data.trendy > 0:
            data.trendy -= 1
            data.save()
    print('ALL DONE!')

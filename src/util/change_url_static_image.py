import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ORIGINAL = 'https://static.blex.kr'
CHANGING = 'https://'

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post

datas = Post.objects.all()

if __name__ == '__main__':
    for data in datas:
        data.text_md = data.text_md.replace(ORIGINAL, CHANGING)
        data.text_html = data.text_html.replace(ORIGINAL, CHANGING)
        data.save()
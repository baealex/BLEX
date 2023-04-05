import os
import sys
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.utils import timezone
from django.db.models import F, Count, Case, When
from django.utils.html import strip_tags
from django.template.defaultfilters import truncatewords

from board.models import Post
from board.modules.post_description import create_post_description

if __name__ == '__main__':
    posts = Post.objects.select_related(
        'config',
    ).filter(
        created_date__lte=timezone.now(),
        config__notice=False,
        config__hide=False,
    ).annotate(
        author_username=F('author__username'),
        author_image=F('author__profile__avatar'),
        week_view_count=Count(
            Case(
                When(
                    analytics__created_date__gt=timezone.now() - timezone.timedelta(days=7),
                    then='analytics__table'
                )
            ),
            distinct=True
        ),
    ).order_by('-week_view_count', '-created_date')

    for post in posts:
        print(f'\"{post.title}\" 글의 주간 조회수는 \"{post.week_view_count}\"이고 글의 길이는 \"{len(post.content.text_html)}\"입니다.')
        print(f'1. 상세 설명으로 작성')
        print(f'2. 일반 설명으로 작성')
        answer = input(f": ")

        if answer == '1':
            post.meta_description = create_post_description(post.content.text_html)
            print(post.meta_description)
            post.save()
        elif answer == '2':
            post.meta_description = truncatewords(strip_tags(post.content.text_html), 50)
            print(post.meta_description)
            post.save()
        else:
            if post.week_view_count < 10 or len(post.content.text_html) < 1000:
                post.meta_description = truncatewords(strip_tags(post.content.text_html), 50)
                print(post.meta_description)
                post.save()

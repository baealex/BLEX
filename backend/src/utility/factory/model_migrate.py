import os
import sys
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, PostContent, PostConfig

if __name__ == '__main__':
    posts = Post.objects.all()

    for post in posts:
        print(post)

        # tag migrate
        post.set_tags(post.tag)
        time.sleep(0.05)

        # post content migrate
        post_content = PostContent(posts=post)
        post_content.text_md = post.text_md
        post_content.text_html = post.text_html
        post_content.text_block = post.text_block
        post_content.save()
        time.sleep(0.05)

        # post config migrate
        post_config = PostConfig(posts=post)
        post_config.hide = post.hide
        post_config.notice = post.notice
        post_config.advertise = post.advertise
        post_config.block_comment = post.block_comment
        post_config.save()
        time.sleep(0.05)

        post.tag = ''
        post.text_md = ''
        post.text_html = ''
        post.text_block = ''
        post.save()
        time.sleep(0.05)
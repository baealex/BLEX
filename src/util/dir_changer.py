import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Profile

posts = Post.objects.all()
profiles = Profile.objects.all()

if __name__ == '__main__':
    for post in posts:
        ORIGINAL = 'blex.kr'
        CHANGING = 'blex.me'
        
        post.text_md = post.text_md.replace(ORIGINAL, CHANGING)
        post.text_html = post.text_html.replace(ORIGINAL, CHANGING)
        post.save()
    
    for post in posts:
        ORIGINAL = 'image'
        CHANGING = 'images/content'
        
        post.text_md = post.text_md.replace(ORIGINAL, CHANGING)
        post.text_html = post.text_html.replace(ORIGINAL, CHANGING)
        post.save()
    
    for post in posts:
        ORIGINAL = 'title'
        CHANGING = 'images/title'
        
        if post.image:
            try:
                post.image = str(post.image).replace(ORIGINAL, CHANGING)
                post.save()
            except:
                pass
    
    for profile in profiles:
        ORIGINAL = 'avatar'
        CHANGING = 'images/avatar'

        if profile.avatar:
            try:
                profile.avatar = str(profile.avatar).replace(ORIGINAL, CHANGING)
                profile.save()
            except:
                pass

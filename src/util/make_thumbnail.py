import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Thread, Profile

def make_thumbnail(this, size, save_as=False, quality=100):
    if hasattr(this, 'avatar'):
        this.image = this.avatar
    image = Image.open(this.image)
    image.thumbnail((size, size), Image.ANTIALIAS)
    image.save(BASE_DIR + '/static/' + (str(this.image) if not save_as else this.get_thumbnail()), quality=quality)

from PIL import Image

posts = Post.objects.all()
threads = Thread.objects.all()
profiles = Profile.objects.all()

for post in posts:
    if post.image:
        try:
            make_thumbnail(post, 750, True)
        except FileNotFoundError:
            print(post.image, 'NOT FOUND')

for thread in threads:
    if thread.image:
        try:
            make_thumbnail(thread, 750, True)
        except FileNotFoundError:
            print(post.image, 'NOT FOUND')

for profile in profiles:
    if profile.avatar:
        try:
            make_thumbnail(profile, 500)
        except FileNotFoundError:
            print(profile.avatar, 'NOT FOUND')
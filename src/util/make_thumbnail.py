import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Thread
from board.models import Profile

from PIL import Image

posts = Post.objects.all()
threads = Thread.objects.all()
profiles = Profile.objects.all()

for post in posts:
    if post.image:
        image = Image.open(post.image)
        image.thumbnail((500, 500), Image.ANTIALIAS)
        image.save(BASE_DIR + '/static/' + post.get_thumbnail(), quality=85)

for thread in threads:
    if thread.image:
        image = Image.open(thread.image)
        image.thumbnail((500, 500), Image.ANTIALIAS)
        image.save(BASE_DIR + '/static/' + thread.get_thumbnail(), quality=85)

for profile in profiles:
    if profile.avatar:
        image = Image.open(profile.avatar)
        image.thumbnail((350, 350), Image.ANTIALIAS)
        image.save(BASE_DIR + '/static/' + str(profile.avatar), quality=85)
import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import *

if __name__ == '__main__':
    profiles = Profile.objects.all()

    for profile in profiles:
        if profile.facebook:
            UserLinkMeta.objects.create(
                user=profile.user,
                name='facebook',
                value=profile.facebook
            )
        if profile.twitter:
            UserLinkMeta.objects.create(
                user=profile.user,
                name='twitter',
                value=profile.twitter
            )
        if profile.instagram:
            UserLinkMeta.objects.create(
                user=profile.user,
                name='instagram',
                value=profile.instagram
            )
        if profile.github:
            UserLinkMeta.objects.create(
                user=profile.user,
                name='github',
                value=profile.github
            )
        if profile.linkedin:
            UserLinkMeta.objects.create(
                user=profile.user,
                name='linkedin',
                value=profile.linkedin
            )
        if profile.youtube:
            UserLinkMeta.objects.create(
                user=profile.user,
                name='youtube',
                value=profile.youtube
            )

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
        socials = profile.collect_social()
        for key in socials.keys():
            url = ''
            if key == 'homepage':
                url = 'https://' + socials[key]
            if key == 'facebook':
                url = 'https://facebook.com/' + socials[key]
            if key == 'twitter':
                url = 'https://x.com/' + socials[key]
            if key == 'instagram':
                url = 'https://instagram.com/' + socials[key]
            if key == 'github':
                url = 'https://github.com/' + socials[key]
            if key == 'linkedin':
                url = 'https://linkedin.com/in/' + socials[key]
            if key == 'youtube':
                url = 'https://youtube.com/channel/' + socials[key]
            
            UserLinkMeta.objects.create(
                user=profile.user,
                name=key,
                value=url
            )

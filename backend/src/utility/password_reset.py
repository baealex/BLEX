import os
import sys
import django
from secrets import token_urlsafe

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.contrib.auth.models import User
from django.db import transaction
from board.services.developer_token_service import DeveloperTokenService

if __name__ == '__main__':
    username = ''

    if len(sys.argv) > 1 and sys.argv[1]:
        username = sys.argv[1]
    else:
        username = input('Input username : ')

    new_password = token_urlsafe(24)

    with transaction.atomic():
        user = User.objects.select_for_update().get(username=username)
        user.set_password(new_password)
        user.save(update_fields=['password'])
        DeveloperTokenService.revoke_user_tokens(user)
 
    print('New password: ', new_password)
    print('DONE')

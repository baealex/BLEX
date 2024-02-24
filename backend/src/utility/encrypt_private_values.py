import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import TelegramSync, OpenAIConnection

if __name__ == '__main__':
    telegrams = TelegramSync.objects.all()
    for telegram in telegrams:
        telegram.save()

    openai_connections = OpenAIConnection.objects.all()
    for openai_connection in openai_connections:
        openai_connection.save()

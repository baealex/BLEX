import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Font, Theme

# Noto Sans
# RIDIBatang
# Noto Sans Serif

# Default
# Dark Mode
# Violet
# Green & Blue
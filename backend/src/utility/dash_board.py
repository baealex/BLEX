import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.db.models import Sum, Count, F
from django.utils import timezone

from board.models import User, PostAnalytics

if __name__ == '__main__':
    today = timezone.now()

    joined_users = User.objects.filter(date_joined=today)
    print(f"- Today joined user : {joined_users.count()}")

    login_users = User.objects.filter(last_login=today)
    print(f"- Today login user : {login_users.count()}")
    
    today_views = PostAnalytics.objects.filter(
        created_date=today
    ).annotate(
        table_count=Count('devices')
    ).aggregate(
        total=Sum('table_count')
    )
    print(f"- Today site view : {today_views['total']}")

    best_articles = PostAnalytics.objects.filter(
        created_date=today
    ).annotate(
        title=F('posts__title'),
        table_count=Count('devices')
    ).order_by('-table_count')[:10]
    print('- Today best article TOP 10')
    for article in best_articles:
        print(f"  - {article.title} ({article.table_count})")
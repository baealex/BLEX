import os
import sys
import django
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings
from board.models import PostContent, Comment

def migrate_content(content):
    """Migrate old static URLs to new resource structure"""
    if not content:
        return content, False
    
    # Pattern to match old static URLs  
    old_patterns = [
        (r'https://static\.blex\.me/images/', settings.MEDIA_URL + 'images/'),
        (r'http://static\.blex\.me/images/', settings.MEDIA_URL + 'images/'),
        (r'//static\.blex\.me/images/', settings.MEDIA_URL + 'images/'),
    ]
    
    migrated = content
    changed = False
    
    for old_pattern, new_url in old_patterns:
        old_migrated = migrated
        migrated = re.sub(old_pattern, new_url, migrated)
        if old_migrated != migrated:
            changed = True
    
    return migrated, changed

if __name__ == '__main__':
    dry_run = False
    
    if len(sys.argv) > 1 and sys.argv[1] == '--dry-run':
        dry_run = True
        print("DRY RUN MODE - No changes will be made")
        print("=" * 50)
    
    # Migrate PostContent
    print('Migrating PostContent...')
    updated_posts = 0
    
    for post_content in PostContent.objects.all():
        new_content, changed = migrate_content(post_content.text_html)
        if changed:
            if not dry_run:
                post_content.text_html = new_content
                post_content.save()
                print(f"Updated PostContent ID: {post_content.id}")
            else:
                print(f"Would update PostContent ID: {post_content.id}")
            updated_posts += 1

    # Migrate Comments
    print('Migrating Comments...')  
    updated_comments = 0
    
    for comment in Comment.objects.all():
        new_content, changed = migrate_content(comment.text_html)
        if changed:
            if not dry_run:
                comment.text_html = new_content
                comment.save()
                print(f"Updated Comment ID: {comment.id}")
            else:
                print(f"Would update Comment ID: {comment.id}")
            updated_comments += 1

    print("=" * 50)
    if dry_run:
        print(f'DRY RUN: Would update {updated_posts} posts and {updated_comments} comments')
    else:
        print(f'Successfully migrated {updated_posts} posts and {updated_comments} comments')
    
    print('DONE')
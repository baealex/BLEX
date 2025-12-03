#!/usr/bin/env python3
"""
Migrate Legacy Title Images

Moves title images from legacy paths (e.g., images/title/username/...)
to standard dated paths (images/title/YYYY/M/D/username/...).

Based on Post.created_date.
"""

import os
import sys
import shutil
import re
import django

# Django setup
# Robustly find the directory containing 'main' package (backend/src)
current_dir = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = None
while True:
    if os.path.isdir(os.path.join(current_dir, 'main')) and os.path.isfile(os.path.join(current_dir, 'main', 'settings.py')):
        SRC_DIR = current_dir
        break
    parent_dir = os.path.dirname(current_dir)
    if parent_dir == current_dir:
        break
    current_dir = parent_dir

if not SRC_DIR:
    print("Error: Could not find project root (directory containing 'main' package).")
    sys.exit(1)

# Load .env file manually
env_path = os.path.join(os.path.dirname(SRC_DIR), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key, value)

sys.path.append(SRC_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings
from board.models import Post

def is_legacy_path(path):
    """
    Checks if the path is a legacy path.
    Standard path starts with images/title/YYYY/
    Legacy path might look like images/title/username/...
    """
    if not path.startswith('images/title/'):
        return False
        
    parts = path.split('/')
    if len(parts) < 3:
        return False
        
    # Check if the part after images/title/ is a 4-digit year
    year_part = parts[2]
    if re.match(r'^\d{4}$', year_part):
        return False
        
    return True

def migrate_post_image(post):
    if not post.image:
        return False
        
    old_path_rel = post.image.name
    
    if not is_legacy_path(old_path_rel):
        return False
        
    # Construct new path based on created_date
    dt = post.created_date
    username = post.author.username
    filename = os.path.basename(old_path_rel)
    
    # New path: images/title/YYYY/M/D/username/filename
    new_dir_rel = f"images/title/{dt.year}/{dt.month}/{dt.day}/{username}"
    new_path_rel = f"{new_dir_rel}/{filename}"
    
    old_full_path = os.path.join(settings.MEDIA_ROOT, old_path_rel)
    new_full_path = os.path.join(settings.MEDIA_ROOT, new_path_rel)
    
    if not os.path.exists(old_full_path):
        # print(f"  [Warning] File not found: {old_full_path}")
        return False
        
    if os.path.exists(new_full_path):
        print(f"  [Info] Target already exists: {new_full_path}")
        post.image = new_path_rel
        return True
        
    # Create new directory
    os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
    
    # Move main file
    try:
        shutil.move(old_full_path, new_full_path)
        print(f"  Moved: {old_path_rel} -> {new_path_rel}")
        
        # Move related files (.preview, .minify)
        # Logic from models.py: 
        # preview: {image_path}.preview.jpg
        # minify: {image_path}.minify.{ext}
        
        # Check for preview
        old_preview = f"{old_full_path}.preview.jpg"
        if os.path.exists(old_preview):
            new_preview = f"{new_full_path}.preview.jpg"
            shutil.move(old_preview, new_preview)
            # print(f"    Moved preview")
            
        # Check for minify
        # We need to guess the extension or look for files starting with name
        # Simple approach: try common extensions or list dir?
        # Let's try to match the exact pattern from models.py if possible, 
        # but models.py uses the original extension.
        ext = filename.split('.')[-1]
        old_minify = f"{old_full_path}.minify.{ext}"
        if os.path.exists(old_minify):
            new_minify = f"{new_full_path}.minify.{ext}"
            shutil.move(old_minify, new_minify)
            # print(f"    Moved minify")
            
        # Update model
        post.image = new_path_rel
        return True
        
    except Exception as e:
        print(f"  [Error] Failed to move {old_path_rel}: {e}")
        return False

def main():
    print("Starting title image migration...")
    posts = Post.objects.all()
    count = 0
    total = posts.count()
    
    for i, post in enumerate(posts, 1):
        if migrate_post_image(post):
            post.save()
            count += 1
            
    print(f"\nMigration complete. Updated {count} posts.")

if __name__ == '__main__':
    main()

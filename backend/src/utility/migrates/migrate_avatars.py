#!/usr/bin/env python3
"""
Migrate Avatar Images to Hex-Sharded Structure

Moves avatar and cover images from:
  images/avatar/u/{username}/...
to:
  images/avatar/{hex}/{username}/...

Where {hex} is the first 2 characters of MD5(username).
"""

import os
import sys
import shutil
import hashlib
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
        # Reached root without finding main
        break
    current_dir = parent_dir

if not SRC_DIR:
    # Fallback or error
    print("Error: Could not find project root (directory containing 'main' package).")
    sys.exit(1)

# Load .env file manually (assumed to be in parent of SRC_DIR)
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
from board.models import Profile

def get_user_hex(username):
    return hashlib.md5(username.encode()).hexdigest()[:2]

def migrate_image(profile, field_name):
    image_field = getattr(profile, field_name)
    if not image_field:
        return False

    old_path_rel = image_field.name
    username = profile.user.username
    hex_prefix = get_user_hex(username)
    
    # Construct expected relative path
    filename = os.path.basename(old_path_rel)
    expected_dir_rel = f"images/avatar/{hex_prefix}/{username}"
    
    # Check if currently in the correct directory
    if os.path.dirname(old_path_rel) == expected_dir_rel:
        return False

    # New path
    new_path_rel = f"{expected_dir_rel}/{filename}"
    
    old_full_path = os.path.join(settings.MEDIA_ROOT, old_path_rel)
    new_full_path = os.path.join(settings.MEDIA_ROOT, new_path_rel)
    
    if not os.path.exists(old_full_path):
        return False

    if os.path.exists(new_full_path):
        print(f"  [Info] Target already exists: {new_full_path}")
        setattr(profile, field_name, new_path_rel)
        return True

    # Create new directory
    os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
    
    # Move file
    try:
        shutil.move(old_full_path, new_full_path)
        print(f"  Moved: {old_path_rel} -> {new_path_rel}")
        
        # Update model
        setattr(profile, field_name, new_path_rel)
        return True
    except Exception as e:
        print(f"  [Error] Failed to move {old_path_rel}: {e}")
        return False

def main():
    print("Starting avatar migration...")
    profiles = Profile.objects.all()
    count = 0
    total = profiles.count()
    
    for i, profile in enumerate(profiles, 1):
        changed = False
        print(f"[{i}/{total}] Processing {profile.user.username}...")
        
        if migrate_image(profile, 'avatar'):
            changed = True
        
        if migrate_image(profile, 'cover'):
            changed = True
            
        if changed:
            profile.save()
            count += 1
            
    print(f"\nMigration complete. Updated {count} profiles.")
    
    # Optional: Cleanup empty 'u' directories
    u_dir = os.path.join(settings.MEDIA_ROOT, 'images/avatar/u')
    if os.path.exists(u_dir):
        print(f"\nCleaning up empty directories in {u_dir}...")
        for root, dirs, files in os.walk(u_dir, topdown=False):
            for name in dirs:
                try:
                    os.rmdir(os.path.join(root, name))
                except OSError:
                    pass # Directory not empty
        try:
            os.rmdir(u_dir) # Try to remove 'u' itself if empty
        except OSError:
            pass

if __name__ == '__main__':
    main()

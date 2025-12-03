#!/usr/bin/env python3
"""
Image Cleaner Utility

Merges functionality of content_image.py and title_image.py.
Safely removes unused images from 'resources/media/images/content' and 'resources/media/images/title'.
Supports dry-run mode and empty directory cleanup.
"""

import os
import sys
import re
import time
import argparse
import hashlib
import django
from itertools import chain

# Django setup
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env file manually
env_path = os.path.join(os.path.dirname(BASE_DIR), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key, value)

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.db.models import F
from board.models import Post, Comment, TempPosts, ImageCache, Profile, Series

CONTENT_IMAGE_DIR = os.path.join(BASE_DIR, 'resources/media/images/content')
TITLE_IMAGE_DIR = os.path.join(BASE_DIR, 'resources/media/images/title')
AVATAR_IMAGE_DIR = os.path.join(BASE_DIR, 'resources/media/images/avatar')

def get_clean_filename(filename):
    """Removes suffixes like .preview or .minify to get the original filename."""
    if 'preview' in filename:
        filename = filename.split('.preview')[0]
    if 'minify' in filename:
        filename = filename.split('.minify')[0]
    return filename

def calculate_file_hash(filepath):
    """Calculates SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception:
        return None

def remove_empty_dirs(path, dry_run=True):
    """Recursively removes empty directories."""
    if not os.path.isdir(path):
        return

    # Walk from bottom up
    for root, dirs, files in os.walk(path, topdown=False):
        for name in dirs:
            dir_path = os.path.join(root, name)
            try:
                # Check if directory is empty
                if not os.listdir(dir_path):
                    if dry_run:
                        print(f"[Dry-Run] Would remove empty directory: {dir_path}")
                    else:
                        print(f"Removing empty directory: {dir_path}")
                        os.rmdir(dir_path)
            except OSError as e:
                print(f"Error removing directory {dir_path}: {e}")

def scan_content_images():
    """Scans database for used content images."""
    image_parser = re.compile(r'\!\[.*\]\(([^\s\"]*).*\)')
    video_parser = re.compile(r'\@gif\[(.*)\]')
    src_parser = re.compile(r'src=[\'\"]([^\'\"]*)[\'\"]')

    used_files = set()

    posts = Post.objects.all().annotate(
        text_md=F('content__text_md'),
        text_html=F('content__text_html')
    )
    comments = Comment.objects.all()
    temp_posts = TempPosts.objects.all()
    profiles = Profile.objects.all().annotate(
        text_md=F('about_md'),
        text_html=F('about_html')
    )
    series = Series.objects.all()

    print("Scanning content images in database...")
    for item in chain(posts, temp_posts, comments, profiles, series):
        text_md = getattr(item, 'text_md', '') or ''
        # For comments or temp_posts that might not have text_html annotation or field
        text_html = getattr(item, 'text_html', '') or ''
        
        # If item is a Comment or TempPost, it might have 'text' field instead of 'content__text_md'
        # Adjusting based on typical Django models, but using getattr to be safe
        if hasattr(item, 'text'): # Fallback for simple models if needed
             text_md = item.text

        images = image_parser.findall(text_md)
        videos = video_parser.findall(text_md)
        
        etc = []
        if text_html:
            etc = src_parser.findall(text_html)
        else:
            etc = src_parser.findall(text_md)

        for path in chain(images, videos, etc):
            # Extract filename from path (e.g., /static/media/images/content/foo.jpg -> foo.jpg)
            filename = path.split('/')[-1]
            clean_name = get_clean_filename(filename)
            used_files.add(clean_name)
            
    return used_files

def scan_title_images():
    """Scans database for used title images."""
    used_files = set()
    posts = Post.objects.all()
    
    print("Scanning title images in database...")
    for post in posts:
        if post.image:
            filename = str(post.image).split('/')[-1]
            used_files.add(filename)
            
    return used_files

def scan_avatar_images():
    """Scans database for used avatar and cover images."""
    used_files = set()
    profiles = Profile.objects.all()
    
    print("Scanning avatar images in database...")
    for profile in profiles:
        if profile.avatar:
            filename = str(profile.avatar).split('/')[-1]
            used_files.add(filename)
        if profile.cover:
            filename = str(profile.cover).split('/')[-1]
            used_files.add(filename)
            
    return used_files

def find_duplicates(target_dir):
    """Finds duplicate files in the target directory based on content hash."""
    print(f"\nScanning for duplicates in: {target_dir}")
    hashes = {}
    duplicates = []

    for root, dirs, files in os.walk(target_dir):
        for filename in files:
            full_path = os.path.join(root, filename)
            file_hash = calculate_file_hash(full_path)
            
            if file_hash:
                if file_hash in hashes:
                    duplicates.append((full_path, hashes[file_hash]))
                else:
                    hashes[file_hash] = full_path
    
    if duplicates:
        filtered_duplicates = []
        for new, original in duplicates:
            # Skip if one is a derivative of the other (e.g. .minify, .preview)
            # This happens when the minified version is identical to the original
            if new.startswith(original) or original.startswith(new):
                continue
            filtered_duplicates.append((new, original))

        if filtered_duplicates:
            print(f"Found {len(filtered_duplicates)} duplicate pairs:")
            for new, original in filtered_duplicates:
                print(f"  Duplicate: {new} == {original}")
        else:
            print("No duplicates found (ignoring derivatives).")
    else:
        print("No duplicates found.")

def clean_directory(target_dir, used_files, dry_run=True):
    """Cleans unused files in the target directory."""
    print(f"\nCleaning directory: {target_dir}")
    
    # Check for duplicates first
    find_duplicates(target_dir)
    
    files_to_remove = []
    
    for root, dirs, files in os.walk(target_dir):
        for filename in files:
            clean_name = get_clean_filename(filename)
            
            if clean_name not in used_files:
                full_path = os.path.join(root, filename)
                files_to_remove.append(full_path)

    print(f"\nFound {len(files_to_remove)} unused files.")
    
    for path in files_to_remove:
        if dry_run:
            print(f"[Dry-Run] Would remove: {path}")
        else:
            print(f"Removing: {path}")
            try:
                os.remove(path)
                time.sleep(0.01) # Small delay to be nice to FS
            except OSError as e:
                print(f"Error removing {path}: {e}")

def clean_image_cache(used_content_files, dry_run=True):
    """Cleans ImageCache entries that are no longer used."""
    print("\nCleaning ImageCache...")
    
    caches_to_remove = []
    
    for image_cache in ImageCache.objects.all():
        cache_filename = image_cache.path.split('/')[-1]
        # ImageCache usually stores content images
        if cache_filename not in used_content_files:
            caches_to_remove.append(image_cache)
            
    print(f"Found {len(caches_to_remove)} unused cache entries.")
    
    for cache in caches_to_remove:
        if dry_run:
            print(f"[Dry-Run] Would remove cache entry: {cache.pk} - {cache.path}")
        else:
            print(f"Removing cache entry: {cache.pk} - {cache.path}")
            cache.delete()
            time.sleep(0.01)

def main():
    parser = argparse.ArgumentParser(description='Clean unused images and empty directories.')
    parser.add_argument('--dry-run', action='store_true', default=True, help='Simulate deletion (default)')
    parser.add_argument('--execute', action='store_true', help='Actually delete files')
    
    args = parser.parse_args()
    
    # If --execute is passed, dry_run is False. Otherwise it's True.
    # However, argparse default is True for dry-run flag if present, but we want default to be True if NO flag is passed?
    # Actually, standard pattern:
    # python script.py -> dry run
    # python script.py --execute -> real run
    
    dry_run = not args.execute
    
    if dry_run:
        print("="*40)
        print(" DRY RUN MODE - No files will be deleted")
        print(" Use --execute to perform deletion")
        print("="*40)
    else:
        print("="*40)
        print(" EXECUTE MODE - Files WILL be deleted")
        print("="*40)

    # 1. Scan for used files
    used_content_files = scan_content_images()
    used_title_files = scan_title_images()
    used_avatar_files = scan_avatar_images()
    
    print(f"Used content images: {len(used_content_files)}")
    print(f"Used title images: {len(used_title_files)}")
    print(f"Used avatar images: {len(used_avatar_files)}")

    # 2. Clean Content Images
    if os.path.exists(CONTENT_IMAGE_DIR):
        clean_directory(CONTENT_IMAGE_DIR, used_content_files, dry_run=dry_run)
        remove_empty_dirs(CONTENT_IMAGE_DIR, dry_run=dry_run)
    else:
        print(f"Directory not found: {CONTENT_IMAGE_DIR}")

    # 3. Clean Title Images
    if os.path.exists(TITLE_IMAGE_DIR):
        clean_directory(TITLE_IMAGE_DIR, used_title_files, dry_run=dry_run)
        remove_empty_dirs(TITLE_IMAGE_DIR, dry_run=dry_run)
    else:
        print(f"Directory not found: {TITLE_IMAGE_DIR}")

    # 4. Clean Avatar Images
    if os.path.exists(AVATAR_IMAGE_DIR):
        clean_directory(AVATAR_IMAGE_DIR, used_avatar_files, dry_run=dry_run)
        remove_empty_dirs(AVATAR_IMAGE_DIR, dry_run=dry_run)
    else:
        print(f"Directory not found: {AVATAR_IMAGE_DIR}")

    # 5. Clean Image Cache (Related to content images)
    clean_image_cache(used_content_files, dry_run=dry_run)

    print("\nDone.")

if __name__ == '__main__':
    main()

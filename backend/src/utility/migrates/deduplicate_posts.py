#!/usr/bin/env python3
"""
Deduplicate Post Images

Scans all Post images, calculates hashes, and identifies duplicates.
Updates Post models to point to a single 'master' image for each hash group.
Deletes redundant image files.
"""

import os
import sys
import hashlib
import django

# Django setup
# Current file: backend/src/utility/migrates/deduplicate_posts.py
# Root: backend/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Load .env file manually
env_path = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key, value)

sys.path.append(os.path.join(BASE_DIR, 'src'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings
from board.models import Post

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

def main():
    print("Starting Post image deduplication...")
    
    posts = Post.objects.all()
    total = posts.count()
    
    print(f"Scanning {total} posts...")
    
    # hash -> list of unique file_paths
    content_map = {} 
    
    for i, post in enumerate(posts, 1):
        if not post.image:
            continue
        try:
            # Get absolute path
            if hasattr(post.image, 'path'):
                file_path = post.image.path
            else:
                file_path = os.path.join(settings.MEDIA_ROOT, str(post.image))
            
            if not os.path.exists(file_path): continue
            
            file_hash = calculate_file_hash(file_path)
            if not file_hash: continue
            
            if file_hash not in content_map:
                content_map[file_hash] = set()
            content_map[file_hash].add(file_path)
        except:
            continue
            
    duplicates_count = 0
    space_saved = 0
            
    # Now look for hashes with > 1 unique file path
    for file_hash, paths in content_map.items():
        if len(paths) > 1:
            paths_list = list(paths)
            # Sort to pick a deterministic master (e.g., shortest path or first alphabetically)
            paths_list.sort() 
            master_path = paths_list[0]
            redundant_paths = paths_list[1:]
            
            print(f"\nFound duplicate content (Hash: {file_hash[:8]}...):")
            print(f"  Master: {master_path}")
            
            # Find all posts using redundant paths and update them
            for bad_path in redundant_paths:
                print(f"  Redundant: {bad_path}")
                
                rel_master = os.path.relpath(master_path, settings.MEDIA_ROOT)
                
                # Find posts that use bad_path
                for post in Post.objects.all():
                    if not post.image: continue
                    try:
                        # Check absolute path equality
                        if hasattr(post.image, 'path'):
                            p_path = post.image.path
                        else:
                            p_path = os.path.join(settings.MEDIA_ROOT, str(post.image))
                            
                        if p_path == bad_path:
                            print(f"    Updating Post {post.id} to use master image.")
                            post.image = rel_master
                            post.save()
                    except:
                        pass
                
                # Now delete the bad file
                try:
                    os.remove(bad_path)
                    print(f"    Deleted redundant file.")
                    space_saved += os.path.getsize(master_path)
                    duplicates_count += 1
                    
                    # Also check for .preview and .minify versions and delete them
                    # This is a best-effort cleanup
                    for suffix in ['.preview.jpg', '.minify.jpg', '.minify.png']:
                         # Construct potential preview path
                         # Logic from models.py: f"{image_path}.preview.jpg"
                         preview_path = f"{bad_path}{suffix}"
                         if os.path.exists(preview_path):
                             os.remove(preview_path)
                             print(f"    Deleted preview: {preview_path}")

                except Exception as e:
                    print(f"    Error deleting: {e}")

    print(f"\nDeduplication complete.")
    print(f"Removed {duplicates_count} duplicate files.")

if __name__ == '__main__':
    main()

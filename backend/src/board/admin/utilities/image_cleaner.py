"""
이미지 정리 서비스
"""
import os
import re
import time
import hashlib
from typing import List, Dict, Any, Tuple
from itertools import chain

from django.conf import settings
from django.db.models import F

from board.models import Post, Comment, ImageCache, Profile, Series


class ImageCleanerService:
    """이미지 정리 서비스"""

    def __init__(self):
        # settings.MEDIA_ROOT를 직접 사용 (backend/src/resources/media)
        self.content_image_dir = os.path.join(settings.MEDIA_ROOT, 'images/content')
        self.title_image_dir = os.path.join(settings.MEDIA_ROOT, 'images/title')
        self.avatar_image_dir = os.path.join(settings.MEDIA_ROOT, 'images/avatar')

    @staticmethod
    def get_clean_filename(filename: str) -> str:
        """파일명에서 접미사 제거 (.preview, .minify)"""
        # .preview.jpg 제거
        if '.preview' in filename:
            filename = filename.split('.preview')[0]
        # .minify.확장자 제거
        if '.minify' in filename:
            filename = filename.split('.minify')[0]
        return filename

    @staticmethod
    def calculate_file_hash(filepath: str) -> str:
        """파일 해시 계산"""
        sha256_hash = hashlib.sha256()
        try:
            with open(filepath, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception:
            return None

    def scan_content_images(self) -> set:
        """컨텐츠 이미지 스캔"""
        image_parser = re.compile(r'\!\[.*\]\(([^\s\"]*).*\)')
        video_parser = re.compile(r'\@gif\[(.*)\]')
        src_parser = re.compile(r'src=[\'"]([^\'"]*)[\'"]')

        used_files = set()

        posts = Post.objects.all().annotate(
            text_md=F('content__text_md'),
            text_html=F('content__text_html')
        )
        comments = Comment.objects.all()
        profiles = Profile.objects.all().annotate(
            text_md=F('about_md'),
            text_html=F('about_html')
        )
        series = Series.objects.all()

        for item in chain(posts, comments, profiles, series):
            text_md = getattr(item, 'text_md', '') or ''
            text_html = getattr(item, 'text_html', '') or ''

            if hasattr(item, 'text'):
                text_md = item.text

            images = image_parser.findall(text_md)
            videos = video_parser.findall(text_md)

            etc = []
            if text_html:
                etc = src_parser.findall(text_html)
            else:
                etc = src_parser.findall(text_md)

            for path in chain(images, videos, etc):
                filename = path.split('/')[-1]
                clean_name = self.get_clean_filename(filename)
                used_files.add(clean_name)

        return used_files

    def scan_title_images(self) -> set:
        """타이틀 이미지 스캔"""
        used_files = set()
        posts = Post.objects.all()

        for post in posts:
            if post.image:
                filename = str(post.image).split('/')[-1]
                used_files.add(filename)

        return used_files

    def scan_avatar_images(self) -> set:
        """아바타 이미지 스캔"""
        used_files = set()
        profiles = Profile.objects.all()

        for profile in profiles:
            if profile.avatar:
                filename = str(profile.avatar).split('/')[-1]
                used_files.add(filename)
            if profile.cover:
                filename = str(profile.cover).split('/')[-1]
                used_files.add(filename)

        return used_files

    def find_duplicates(self, target_dir: str) -> List[Tuple[str, str]]:
        """중복 파일 찾기"""
        if not os.path.exists(target_dir):
            return []

        hashes = {}
        duplicates = []

        for root, dirs, files in os.walk(target_dir):
            for filename in files:
                full_path = os.path.join(root, filename)
                file_hash = self.calculate_file_hash(full_path)

                if file_hash:
                    if file_hash in hashes:
                        duplicates.append((full_path, hashes[file_hash]))
                    else:
                        hashes[file_hash] = full_path

        # 중복에서 파생 파일 제외
        filtered_duplicates = []
        for new, original in duplicates:
            if new.startswith(original) or original.startswith(new):
                continue
            filtered_duplicates.append((new, original))

        return filtered_duplicates

    def scan_directory(self, target_dir: str, used_files: set) -> List[Dict[str, Any]]:
        """디렉토리에서 미사용 파일 찾기"""
        if not os.path.exists(target_dir):
            return []

        files_info = []

        for root, dirs, files in os.walk(target_dir):
            for filename in files:
                clean_name = self.get_clean_filename(filename)
                full_path = os.path.join(root, filename)

                is_used = clean_name in used_files
                file_size = os.path.getsize(full_path) if os.path.exists(full_path) else 0

                files_info.append({
                    'path': full_path,
                    'relative_path': os.path.relpath(full_path, target_dir),
                    'filename': filename,
                    'clean_name': clean_name,
                    'is_used': is_used,
                    'size': file_size,
                    'size_kb': round(file_size / 1024, 2)
                })

        return files_info

    def clean_files(self, files_to_remove: List[str]) -> Tuple[int, List[str]]:
        """파일 실제 삭제"""
        success_count = 0
        errors = []

        for file_path in files_to_remove:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    success_count += 1
                    time.sleep(0.01)
            except OSError as e:
                errors.append(f"{file_path}: {str(e)}")

        return success_count, errors

    def remove_empty_dirs(self, path: str) -> int:
        """빈 디렉토리 제거"""
        if not os.path.isdir(path):
            return 0

        count = 0
        for root, dirs, files in os.walk(path, topdown=False):
            for name in dirs:
                dir_path = os.path.join(root, name)
                try:
                    if not os.listdir(dir_path):
                        os.rmdir(dir_path)
                        count += 1
                except OSError:
                    pass

        return count

    def clean_image_cache(self, used_content_files: set, execute: bool = False) -> Tuple[int, int]:
        """이미지 캐시 정리"""
        caches_to_remove = []

        for image_cache in ImageCache.objects.all():
            cache_filename = image_cache.path.split('/')[-1]
            if cache_filename not in used_content_files:
                caches_to_remove.append(image_cache)

        count = len(caches_to_remove)

        if execute:
            for cache in caches_to_remove:
                cache.delete()
                time.sleep(0.01)

        return count, count

    def find_and_remove_duplicates(self, target_dir: str, execute: bool = False) -> Tuple[int, int, List[Dict[str, Any]]]:
        """중복 파일 찾기 및 제거"""
        if not os.path.exists(target_dir):
            return 0, 0, []

        hashes = {}
        duplicates = []
        total_size = 0
        removed_count = 0

        # 파일 해시 맵 생성
        for root, dirs, files in os.walk(target_dir):
            for filename in files:
                full_path = os.path.join(root, filename)
                file_hash = self.calculate_file_hash(full_path)

                if file_hash:
                    if file_hash in hashes:
                        # 중복 발견
                        original_path = hashes[file_hash]
                        file_size = os.path.getsize(full_path)

                        # 파생 파일이 아닌 경우만 중복으로 처리
                        if not (full_path.startswith(original_path) or original_path.startswith(full_path)):
                            duplicates.append({
                                'duplicate_path': full_path,
                                'original_path': original_path,
                                'size': file_size,
                                'hash': file_hash[:8]
                            })

                            if execute:
                                try:
                                    os.remove(full_path)
                                    # 관련 파일도 삭제 (.preview, .minify)
                                    for suffix in ['.preview.jpg', '.minify.jpg', '.minify.png']:
                                        preview_path = f"{full_path}{suffix}"
                                        if os.path.exists(preview_path):
                                            os.remove(preview_path)
                                    removed_count += 1
                                    total_size += file_size
                                    time.sleep(0.01)
                                except OSError:
                                    pass
                            else:
                                total_size += file_size
                    else:
                        hashes[file_hash] = full_path

        return len(duplicates), total_size, duplicates

"""
Utility Admin Module
관리자가 유틸리티 기능을 웹 인터페이스로 실행할 수 있도록 제공
"""
import os
import re
import time
import hashlib
from typing import List, Dict, Any, Tuple
from itertools import chain

from django.contrib import admin
from django.shortcuts import render
from django.http import HttpRequest, HttpResponse
from django.urls import path
from django.conf import settings
from django.db.models import F, Count
from django.contrib.admin.models import LogEntry
from django.utils.html import format_html
from django.utils.safestring import SafeString

from board.models import Post, Comment, TempPosts, ImageCache, Profile, Series

from .service import AdminDisplayService
from .constants import COLOR_SUCCESS, COLOR_DANGER, COLOR_WARNING, COLOR_INFO, COLOR_MUTED


class UtilityResult:
    """유틸리티 실행 결과를 담는 클래스"""
    
    def __init__(self):
        self.messages: List[Tuple[str, str]] = []  # (type, message)
        self.statistics: Dict[str, Any] = {}
        self.files: List[Dict[str, Any]] = []  # 파일 정보 목록
    
    def add_message(self, msg_type: str, message: str):
        """메시지 추가 (info, success, warning, error)"""
        self.messages.append((msg_type, message))
    
    def add_statistic(self, key: str, value: Any):
        """통계 정보 추가"""
        self.statistics[key] = value


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
        temp_posts = TempPosts.objects.all()
        profiles = Profile.objects.all().annotate(
            text_md=F('about_md'),
            text_html=F('about_html')
        )
        series = Series.objects.all()
        
        for item in chain(posts, temp_posts, comments, profiles, series):
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


class HTMLValidationService:
    """HTML 태그 검증 서비스"""
    
    @staticmethod
    def find_mismatched_tags(html_content: str) -> List[Dict[str, Any]]:
        """잘못 매칭된 HTML 태그 찾기 (헤딩 태그만)"""
        import re
        
        # 헤딩 태그만 검사
        heading_tags = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}
        
        # 태그 패턴: <tag> 또는 </tag>
        tag_pattern = re.compile(r'<(/?)(\w+)(?:\s[^>]*)?>|</(\w+)>')
        
        stack = []
        mismatches = []
        
        for match in tag_pattern.finditer(html_content):
            is_closing = match.group(1) == '/' or match.group(3) is not None
            tag_name = match.group(2) or match.group(3)
            
            # 헤딩 태그가 아니면 무시
            if tag_name.lower() not in heading_tags:
                continue
            
            if not is_closing:
                # 여는 태그
                stack.append({
                    'tag': tag_name,
                    'position': match.start(),
                    'full_match': match.group(0)
                })
            else:
                # 닫는 태그
                if not stack:
                    mismatches.append({
                        'type': 'extra_closing',
                        'tag': tag_name,
                        'position': match.start(),
                        'text': match.group(0)
                    })
                elif stack[-1]['tag'].lower() != tag_name.lower():
                    # 태그 불일치
                    opening = stack.pop()
                    mismatches.append({
                        'type': 'mismatch',
                        'opening_tag': opening['tag'],
                        'closing_tag': tag_name,
                        'opening_position': opening['position'],
                        'closing_position': match.start(),
                        'opening_text': opening['full_match'],
                        'closing_text': match.group(0)
                    })
                else:
                    # 정상 매칭
                    stack.pop()
        
        # 닫히지 않은 태그
        for unclosed in stack:
            mismatches.append({
                'type': 'unclosed',
                'tag': unclosed['tag'],
                'position': unclosed['position'],
                'text': unclosed['full_match']
            })
        
        return mismatches
    
    @staticmethod
    def fix_mismatched_tags(html_content: str, mismatches: List[Dict[str, Any]]) -> str:
        """잘못된 태그 수정"""
        import re
        
        fixed_html = html_content
        offset = 0
        
        # 매칭 오류만 수정 (여는 태그와 닫는 태그가 다른 경우)
        for mismatch in sorted(mismatches, key=lambda x: x.get('closing_position', x.get('position', 0))):
            if mismatch['type'] == 'mismatch':
                # 닫는 태그를 여는 태그와 맞춤
                old_closing = mismatch['closing_text']
                new_closing = f"</{mismatch['opening_tag']}>"
                
                pos = mismatch['closing_position'] + offset
                before = fixed_html[:pos]
                after = fixed_html[pos:]
                
                # 닫는 태그 교체
                after = after.replace(old_closing, new_closing, 1)
                fixed_html = before + after
                
                offset += len(new_closing) - len(old_closing)
        
        return fixed_html


class MigrationService:
    """마이그레이션 서비스"""
    
    @staticmethod
    def get_user_hex(username: str) -> str:
        """사용자명의 MD5 해시 앞 2자리"""
        return hashlib.md5(username.encode()).hexdigest()[:2]
    
    def migrate_avatars(self, execute: bool = False) -> UtilityResult:
        """아바타 마이그레이션"""
        result = UtilityResult()
        profiles = Profile.objects.all()
        total = profiles.count()
        
        result.add_statistic('total_profiles', total)
        
        migrated_count = 0
        errors = []
        
        for i, profile in enumerate(profiles, 1):
            changed = False
            
            for field_name in ['avatar', 'cover']:
                image_field = getattr(profile, field_name)
                if not image_field:
                    continue
                
                old_path_rel = image_field.name
                username = profile.user.username
                hex_prefix = self.get_user_hex(username)
                
                filename = os.path.basename(old_path_rel)
                expected_dir_rel = f"images/avatar/{hex_prefix}/{username}"
                
                if os.path.dirname(old_path_rel) == expected_dir_rel:
                    continue
                
                new_path_rel = f"{expected_dir_rel}/{filename}"
                old_full_path = os.path.join(settings.MEDIA_ROOT, old_path_rel)
                new_full_path = os.path.join(settings.MEDIA_ROOT, new_path_rel)
                
                if not os.path.exists(old_full_path):
                    continue
                
                if execute:
                    import shutil
                    try:
                        os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
                        shutil.move(old_full_path, new_full_path)
                        setattr(profile, field_name, new_path_rel)
                        changed = True
                    except Exception as e:
                        errors.append(f"{username} - {field_name}: {str(e)}")
                else:
                    changed = True
            
            if changed:
                migrated_count += 1
                if execute:
                    profile.save()
        
        result.add_statistic('migrated_count', migrated_count)
        result.add_statistic('errors', errors)
        
        # 빈 디렉토리 정리 (원본 스크립트와 동일하게)
        if execute and migrated_count > 0:
            u_dir = os.path.join(settings.MEDIA_ROOT, 'images/avatar/u')
            if os.path.exists(u_dir):
                empty_count = 0
                for root, dirs, files in os.walk(u_dir, topdown=False):
                    for name in dirs:
                        try:
                            os.rmdir(os.path.join(root, name))
                            empty_count += 1
                        except OSError:
                            pass  # Directory not empty
                try:
                    os.rmdir(u_dir)  # Try to remove 'u' itself if empty
                    empty_count += 1
                except OSError:
                    pass
                
                if empty_count > 0:
                    result.add_message('success', f'빈 디렉토리 {empty_count}개 삭제 완료')
        
        if migrated_count > 0:
            result.add_message('success', f'{migrated_count}개 프로필의 이미지를 마이그레이션했습니다.')
        else:
            result.add_message('info', '마이그레이션할 이미지가 없습니다.')
        
        return result
    
    def migrate_title_images(self, execute: bool = False) -> UtilityResult:
        """타이틀 이미지 마이그레이션"""
        result = UtilityResult()
        posts = Post.objects.all()
        total = posts.count()
        
        result.add_statistic('total_posts', total)
        
        migrated_count = 0
        errors = []
        
        for post in posts:
            if not post.image:
                continue
            
            old_path_rel = post.image.name
            
            # 이미 표준 경로인지 확인
            if not old_path_rel.startswith('images/title/'):
                continue
            
            parts = old_path_rel.split('/')
            if len(parts) >= 3:
                year_part = parts[2]
                if re.match(r'^\d{4}$', year_part):
                    continue
            
            dt = post.created_date
            username = post.author.username
            filename = os.path.basename(old_path_rel)
            
            new_dir_rel = f"images/title/{dt.year}/{dt.month}/{dt.day}/{username}"
            new_path_rel = f"{new_dir_rel}/{filename}"
            
            old_full_path = os.path.join(settings.MEDIA_ROOT, old_path_rel)
            new_full_path = os.path.join(settings.MEDIA_ROOT, new_path_rel)
            
            if not os.path.exists(old_full_path):
                continue
            
            if execute:
                import shutil
                try:
                    os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
                    shutil.move(old_full_path, new_full_path)
                    
                    # 관련 파일도 이동
                    old_preview = f"{old_full_path}.preview.jpg"
                    if os.path.exists(old_preview):
                        shutil.move(old_preview, f"{new_full_path}.preview.jpg")
                    
                    ext = filename.split('.')[-1]
                    old_minify = f"{old_full_path}.minify.{ext}"
                    if os.path.exists(old_minify):
                        shutil.move(old_minify, f"{new_full_path}.minify.{ext}")
                    
                    post.image = new_path_rel
                    post.save()
                    migrated_count += 1
                except Exception as e:
                    errors.append(f"{post.title}: {str(e)}")
            else:
                migrated_count += 1
        
        result.add_statistic('migrated_count', migrated_count)
        result.add_statistic('errors', errors)
        
        # 빈 디렉토리 정리는 사용자가 수동으로 이미지 정리 기능 사용
        # (타이틀 이미지는 여러 경로에 분산되어 있어서 전체 정리는 위험)
        
        if migrated_count > 0:
            result.add_message('success', f'{migrated_count}개 포스트의 타이틀 이미지를 마이그레이션했습니다.')
            result.add_message('info', '빈 디렉토리 정리는 "이미지 정리" 기능을 사용하세요.')
        else:
            result.add_message('info', '마이그레이션할 이미지가 없습니다.')
        
        return result
    
    def deduplicate_posts(self, execute: bool = False) -> UtilityResult:
        """중복 포스트 이미지 제거"""
        result = UtilityResult()
        posts = Post.objects.all()
        total = posts.count()
        
        result.add_statistic('total_posts', total)
        
        # hash -> set of unique file_paths
        content_map = {}
        
        for post in posts:
            if not post.image:
                continue
            try:
                # Get absolute path
                if hasattr(post.image, 'path'):
                    file_path = post.image.path
                else:
                    file_path = os.path.join(settings.MEDIA_ROOT, str(post.image))
                
                if not os.path.exists(file_path):
                    continue
                
                file_hash = self.calculate_file_hash(file_path)
                if not file_hash:
                    continue
                
                if file_hash not in content_map:
                    content_map[file_hash] = set()
                content_map[file_hash].add(file_path)
            except:
                continue
        
        duplicates_count = 0
        space_saved = 0
        duplicate_groups = []
        
        # Look for hashes with > 1 unique file path
        for file_hash, paths in content_map.items():
            if len(paths) > 1:
                paths_list = list(paths)
                paths_list.sort()  # Deterministic master
                master_path = paths_list[0]
                redundant_paths = paths_list[1:]
                
                duplicate_groups.append({
                    'hash': file_hash[:8],
                    'master': os.path.relpath(master_path, settings.MEDIA_ROOT),
                    'redundant': [os.path.relpath(p, settings.MEDIA_ROOT) for p in redundant_paths],
                    'count': len(redundant_paths)
                })
                
                if execute:
                    rel_master = os.path.relpath(master_path, settings.MEDIA_ROOT)
                    
                    # Find posts using redundant paths and update them
                    for bad_path in redundant_paths:
                        # Update posts
                        for post in Post.objects.all():
                            if not post.image:
                                continue
                            try:
                                if hasattr(post.image, 'path'):
                                    p_path = post.image.path
                                else:
                                    p_path = os.path.join(settings.MEDIA_ROOT, str(post.image))
                                
                                if p_path == bad_path:
                                    post.image = rel_master
                                    post.save()
                            except:
                                pass
                        
                        # Delete the redundant file
                        try:
                            file_size = os.path.getsize(bad_path)
                            os.remove(bad_path)
                            space_saved += file_size
                            duplicates_count += 1
                            
                            # Delete preview and minify versions
                            for suffix in ['.preview.jpg', '.minify.jpg', '.minify.png']:
                                preview_path = f"{bad_path}{suffix}"
                                if os.path.exists(preview_path):
                                    os.remove(preview_path)
                        except Exception:
                            pass
        
        result.add_statistic('duplicates_count', duplicates_count)
        result.add_statistic('space_saved_mb', round(space_saved / (1024 * 1024), 2))
        result.add_statistic('duplicate_groups', duplicate_groups)
        
        if execute:
            if duplicates_count > 0:
                result.add_message('success', f'{duplicates_count}개의 중복 파일을 삭제했습니다.')
                result.add_message('success', f'{result.statistics["space_saved_mb"]} MB의 공간을 절약했습니다.')
            else:
                result.add_message('info', '중복 파일이 없습니다.')
        else:
            if len(duplicate_groups) > 0:
                result.add_message('info', f'{len(duplicate_groups)}개의 중복 그룹을 발견했습니다.')
            else:
                result.add_message('info', '중복 파일이 없습니다.')
        
        return result
    
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


class UtilityAdmin(admin.ModelAdmin):
    """유틸리티 관리 어드민"""
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('dashboard/', self.admin_site.admin_view(self.utility_dashboard_view), name='utility_dashboard'),
            path('clean-images/', self.admin_site.admin_view(self.clean_images_view), name='clean_images'),
            path('clean-logs/', self.admin_site.admin_view(self.clean_logs_view), name='clean_logs'),
            path('migrate-avatars/', self.admin_site.admin_view(self.migrate_avatars_view), name='migrate_avatars'),
            path('migrate-titles/', self.admin_site.admin_view(self.migrate_titles_view), name='migrate_titles'),
            path('deduplicate-posts/', self.admin_site.admin_view(self.deduplicate_posts_view), name='deduplicate_posts'),
            path('validate-html/', self.admin_site.admin_view(self.validate_html_view), name='validate_html'),
        ]
        return custom_urls + urls
    
    def utility_dashboard_view(self, request: HttpRequest) -> HttpResponse:
        """유틸리티 대시보드"""
        context = {
            **self.admin_site.each_context(request),
            'title': '유틸리티 관리',
        }
        return render(request, 'admin/utility_dashboard.html', context)
    
    def clean_images_view(self, request: HttpRequest) -> HttpResponse:
        """이미지 정리"""
        result = None
        
        if request.method == 'POST':
            execute = request.POST.get('execute') == 'true'
            target = request.POST.get('target', 'all')
            
            service = ImageCleanerService()
            result = UtilityResult()
            
            # 사용 중인 파일 스캔
            used_content = service.scan_content_images()
            used_title = service.scan_title_images()
            used_avatar = service.scan_avatar_images()
            
            result.add_statistic('used_content_count', len(used_content))
            result.add_statistic('used_title_count', len(used_title))
            result.add_statistic('used_avatar_count', len(used_avatar))
            
            total_unused = 0
            total_size = 0
            
            # 컨텐츠 이미지
            if target in ['all', 'content']:
                content_files = service.scan_directory(service.content_image_dir, used_content)
                unused_content = [f for f in content_files if not f['is_used']]
                result.add_statistic('unused_content_count', len(unused_content))
                
                if execute:
                    count, errors = service.clean_files([f['path'] for f in unused_content])
                    result.add_message('success', f'컨텐츠 이미지 {count}개 삭제 완료')
                    if errors:
                        for err in errors:
                            result.add_message('error', err)
                else:
                    total_unused += len(unused_content)
                    total_size += sum(f['size'] for f in unused_content)
                    result.files.extend(unused_content)
            
            # 타이틀 이미지
            if target in ['all', 'title']:
                title_files = service.scan_directory(service.title_image_dir, used_title)
                unused_title = [f for f in title_files if not f['is_used']]
                result.add_statistic('unused_title_count', len(unused_title))
                
                if execute:
                    count, errors = service.clean_files([f['path'] for f in unused_title])
                    result.add_message('success', f'타이틀 이미지 {count}개 삭제 완료')
                    if errors:
                        for err in errors:
                            result.add_message('error', err)
                else:
                    total_unused += len(unused_title)
                    total_size += sum(f['size'] for f in unused_title)
                    result.files.extend(unused_title)
            
            # 아바타 이미지
            if target in ['all', 'avatar']:
                avatar_files = service.scan_directory(service.avatar_image_dir, used_avatar)
                unused_avatar = [f for f in avatar_files if not f['is_used']]
                result.add_statistic('unused_avatar_count', len(unused_avatar))
                
                if execute:
                    count, errors = service.clean_files([f['path'] for f in unused_avatar])
                    result.add_message('success', f'아바타 이미지 {count}개 삭제 완료')
                    if errors:
                        for err in errors:
                            result.add_message('error', err)
                else:
                    total_unused += len(unused_avatar)
                    total_size += sum(f['size'] for f in unused_avatar)
                    result.files.extend(unused_avatar)
            
            # 이미지 캐시 정리
            if target in ['all', 'content']:
                cache_count, _ = service.clean_image_cache(used_content, execute)
                result.add_statistic('cache_count', cache_count)
                if execute:
                    result.add_message('success', f'이미지 캐시 {cache_count}개 삭제 완료')
            
            # 빈 디렉토리 정리
            if execute:
                empty_dirs = 0
                if target in ['all', 'content']:
                    empty_dirs += service.remove_empty_dirs(service.content_image_dir)
                if target in ['all', 'title']:
                    empty_dirs += service.remove_empty_dirs(service.title_image_dir)
                if target in ['all', 'avatar']:
                    empty_dirs += service.remove_empty_dirs(service.avatar_image_dir)
                
                if empty_dirs > 0:
                    result.add_message('success', f'빈 디렉토리 {empty_dirs}개 삭제 완료')
            
            result.add_statistic('total_unused', total_unused)
            result.add_statistic('total_size_mb', round(total_size / (1024 * 1024), 2))
        
        context = {
            **self.admin_site.each_context(request),
            'title': '이미지 정리',
            'result': result,
        }
        return render(request, 'admin/clean_images.html', context)
    
    def clean_logs_view(self, request: HttpRequest) -> HttpResponse:
        """로그 정리"""
        result = None
        
        if request.method == 'POST':
            execute = request.POST.get('execute') == 'true'
            
            result = UtilityResult()
            log_count = LogEntry.objects.count()
            result.add_statistic('log_count', log_count)
            
            if execute:
                LogEntry.objects.all().delete()
                result.add_message('success', f'관리자 로그 {log_count}개 삭제 완료')
            else:
                result.add_message('info', f'삭제 예정: {log_count}개의 로그')
        
        context = {
            **self.admin_site.each_context(request),
            'title': '로그 정리',
            'result': result,
        }
        return render(request, 'admin/clean_logs.html', context)
    
    def migrate_avatars_view(self, request: HttpRequest) -> HttpResponse:
        """아바타 마이그레이션"""
        result = None
        
        if request.method == 'POST':
            execute = request.POST.get('execute') == 'true'
            service = MigrationService()
            result = service.migrate_avatars(execute)
        
        context = {
            **self.admin_site.each_context(request),
            'title': '아바타 마이그레이션',
            'result': result,
        }
        return render(request, 'admin/migrate_avatars.html', context)
    
    def migrate_titles_view(self, request: HttpRequest) -> HttpResponse:
        """타이틀 이미지 마이그레이션"""
        result = None
        
        if request.method == 'POST':
            execute = request.POST.get('execute') == 'true'
            service = MigrationService()
            result = service.migrate_title_images(execute)
        
        context = {
            **self.admin_site.each_context(request),
            'title': '타이틀 이미지 마이그레이션',
            'result': result,
        }
        return render(request, 'admin/migrate_titles.html', context)
    
    def deduplicate_posts_view(self, request: HttpRequest) -> HttpResponse:
        """중복 포스트 이미지 제거"""
        result = None
        
        if request.method == 'POST':
            execute = request.POST.get('execute') == 'true'
            service = MigrationService()
            result = service.deduplicate_posts(execute)
        
        context = {
            **self.admin_site.each_context(request),
            'title': '중복 포스트 이미지 제거',
            'result': result,
        }
        return render(request, 'admin/deduplicate_posts.html', context)
    
    def validate_html_view(self, request: HttpRequest) -> HttpResponse:
        """HTML 태그 검증 및 수정"""
        from board.models import PostContent
        
        result = None
        
        if request.method == 'POST':
            execute = request.POST.get('execute') == 'true'
            service = HTMLValidationService()
            
            result = UtilityResult()
            
            all_posts = PostContent.objects.all()
            total = all_posts.count()
            result.add_statistic('total_posts', total)
            
            posts_with_issues = []
            total_issues = 0
            fixed_count = 0
            
            for post_content in all_posts:
                if not post_content.text_html:
                    continue
                
                mismatches = service.find_mismatched_tags(post_content.text_html)
                
                if mismatches:
                    total_issues += len(mismatches)
                    
                    post_info = {
                        'id': post_content.post.id if hasattr(post_content, 'post') else 'N/A',
                        'title': post_content.post.title if hasattr(post_content, 'post') else 'N/A',
                        'issues': mismatches
                    }
                    posts_with_issues.append(post_info)
                    
                    if execute:
                        # 태그 수정
                        fixed_html = service.fix_mismatched_tags(post_content.text_html, mismatches)
                        post_content.text_html = fixed_html
                        post_content.save()
                        fixed_count += 1
            
            result.add_statistic('posts_with_issues', len(posts_with_issues))
            result.add_statistic('total_issues', total_issues)
            result.add_statistic('fixed_count', fixed_count)
            result.add_statistic('issue_details', posts_with_issues[:20])  # 최대 20개만 표시
            
            if execute:
                if fixed_count > 0:
                    result.add_message('success', f'{fixed_count}개 포스트의 HTML 태그를 수정했습니다.')
                    result.add_message('success', f'총 {total_issues}개의 태그 문제를 수정했습니다.')
                else:
                    result.add_message('info', 'HTML 태그 문제가 없습니다.')
            else:
                if len(posts_with_issues) > 0:
                    result.add_message('info', f'{len(posts_with_issues)}개 포스트에서 {total_issues}개의 태그 문제를 발견했습니다.')
                else:
                    result.add_message('info', 'HTML 태그 문제가 없습니다.')
        
        context = {
            **self.admin_site.each_context(request),
            'title': 'HTML 태그 검증',
            'result': result,
        }
        return render(request, 'admin/validate_html.html', context)


# 더미 모델 (URL 라우팅을 위한)
class UtilityProxy(LogEntry):
    class Meta:
        proxy = True
        verbose_name = '유틸리티 관리'
        verbose_name_plural = '유틸리티 관리'


# Admin 등록
@admin.register(UtilityProxy)
class UtilityProxyAdmin(UtilityAdmin):
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def changelist_view(self, request, extra_context=None):
        # 리스트 뷰 대신 대시보드로 리다이렉트
        from django.shortcuts import redirect
        from django.urls import reverse
        return redirect(reverse('admin:utility_dashboard'))

import json
import os

from django.conf import settings
from django.contrib.admin.models import LogEntry
from django.contrib.sessions.models import Session

from board.modules.response import StatusDone, StatusError, ErrorCode
from board.admin.utilities import (
    DatabaseStatsService,
    SessionCleanerService,
    TagCleanerService,
    ImageCleanerService,
)


def utility_stats(request):
    """
    GET /v1/utilities/stats - DB 통계 + 로그 수 반환
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

    if request.method != 'GET':
        return StatusError(ErrorCode.REJECT)

    stats = DatabaseStatsService.get_statistics()
    stats['log_count'] = LogEntry.objects.count()

    return StatusDone(stats)


def utility_clean_tags(request):
    """
    POST /v1/utilities/clean-tags - 태그 정리
    Body: { dry_run: bool }
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    try:
        body = json.loads(request.body.decode('utf-8')) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return StatusError(ErrorCode.VALIDATE, '잘못된 요청입니다.')

    dry_run = body.get('dry_run', True)

    service = TagCleanerService()
    tag_stats = service.get_tag_statistics()
    count, tag_names = service.clean_unused_tags(execute=not dry_run)

    return StatusDone({
        'total_tags': tag_stats['total_tags'],
        'used_tags': tag_stats['used_tags'],
        'unused_tags': tag_stats['unused_tags'],
        'top_tags': tag_stats['top_tags'],
        'cleaned_count': count,
        'cleaned_tags': tag_names[:20],
        'dry_run': dry_run,
    })


def utility_clean_sessions(request):
    """
    POST /v1/utilities/clean-sessions - 세션 정리
    Body: { dry_run: bool, clean_all: bool }
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    try:
        body = json.loads(request.body.decode('utf-8')) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return StatusError(ErrorCode.VALIDATE, '잘못된 요청입니다.')

    dry_run = body.get('dry_run', True)
    clean_all = body.get('clean_all', False)

    total_sessions = Session.objects.count()
    expired_sessions = SessionCleanerService.count_expired_sessions()
    cleaned_count = 0

    if not dry_run:
        if clean_all:
            cleaned_count = SessionCleanerService.clean_all_sessions()
        else:
            cleaned_count = SessionCleanerService.clean_expired_sessions()

    return StatusDone({
        'total_sessions': total_sessions,
        'expired_sessions': expired_sessions,
        'cleaned_count': cleaned_count,
        'clean_all': clean_all,
        'dry_run': dry_run,
    })


def utility_clean_logs(request):
    """
    POST /v1/utilities/clean-logs - 로그 정리
    Body: { dry_run: bool }
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    try:
        body = json.loads(request.body.decode('utf-8')) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return StatusError(ErrorCode.VALIDATE, '잘못된 요청입니다.')

    dry_run = body.get('dry_run', True)
    log_count = LogEntry.objects.count()
    cleaned_count = 0

    if not dry_run:
        LogEntry.objects.all().delete()
        cleaned_count = log_count

    return StatusDone({
        'log_count': log_count,
        'cleaned_count': cleaned_count,
        'dry_run': dry_run,
    })


def utility_clean_images(request):
    """
    POST /v1/utilities/clean-images - 이미지 정리
    Body: { dry_run: bool, target: str, remove_duplicates: bool }
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    try:
        body = json.loads(request.body.decode('utf-8')) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return StatusError(ErrorCode.VALIDATE, '잘못된 요청입니다.')

    dry_run = body.get('dry_run', True)
    target = body.get('target', 'all')
    remove_duplicates = body.get('remove_duplicates', False)

    if target not in ('all', 'content', 'title', 'avatar'):
        return StatusError(ErrorCode.VALIDATE, '유효하지 않은 대상입니다.')

    service = ImageCleanerService()
    messages = []

    used_content = service.scan_content_images()
    used_title = service.scan_title_images()
    used_avatar = service.scan_avatar_images()

    total_unused = 0
    total_size = 0
    total_duplicates = 0
    total_duplicate_size = 0
    unused_files = []
    duplicate_files = []

    def to_file_info(file_dict, media_prefix):
        """파일 정보를 미디어 URL 포함 dict로 변환"""
        relative = file_dict['relative_path']
        return {
            'path': relative,
            'url': settings.MEDIA_URL + media_prefix + '/' + relative,
            'size_kb': file_dict['size_kb'],
        }

    # 컨텐츠 이미지
    if target in ('all', 'content'):
        content_files = service.scan_directory(service.content_image_dir, used_content)
        unused_content = [f for f in content_files if not f['is_used']]
        total_unused += len(unused_content)
        total_size += sum(f['size'] for f in unused_content)

        if not dry_run:
            count, errors = service.clean_files([f['path'] for f in unused_content])
            messages.append(f'컨텐츠 이미지 {count}개 삭제 완료')
            for err in errors:
                messages.append(f'오류: {err}')
        else:
            unused_files.extend([
                to_file_info(f, 'images/content') for f in unused_content
            ])

    # 타이틀 이미지
    if target in ('all', 'title'):
        title_files = service.scan_directory(service.title_image_dir, used_title)
        unused_title = [f for f in title_files if not f['is_used']]
        total_unused += len(unused_title)
        total_size += sum(f['size'] for f in unused_title)

        if not dry_run:
            count, errors = service.clean_files([f['path'] for f in unused_title])
            messages.append(f'타이틀 이미지 {count}개 삭제 완료')
            for err in errors:
                messages.append(f'오류: {err}')
        else:
            unused_files.extend([
                to_file_info(f, 'images/title') for f in unused_title
            ])

        if remove_duplicates:
            dup_count, dup_size, duplicates = service.find_and_remove_duplicates(
                service.title_image_dir, not dry_run
            )
            total_duplicates += dup_count
            total_duplicate_size += dup_size
            if dup_count > 0:
                messages.append(
                    f'중복 타이틀 이미지 {dup_count}개 '
                    f'({round(dup_size / (1024 * 1024), 2)} MB)'
                )
            if dry_run:
                duplicate_files.extend([
                    {
                        'duplicateUrl': d['duplicate_url'],
                        'duplicateSizeKb': d['duplicate_size_kb'],
                        'originalUrl': d['original_url'],
                        'originalSizeKb': d['original_size_kb'],
                        'hash': d['hash'],
                    }
                    for d in duplicates
                ])

    # 아바타 이미지
    if target in ('all', 'avatar'):
        avatar_files = service.scan_directory(service.avatar_image_dir, used_avatar)
        unused_avatar = [f for f in avatar_files if not f['is_used']]
        total_unused += len(unused_avatar)
        total_size += sum(f['size'] for f in unused_avatar)

        if not dry_run:
            count, errors = service.clean_files([f['path'] for f in unused_avatar])
            messages.append(f'아바타 이미지 {count}개 삭제 완료')
            for err in errors:
                messages.append(f'오류: {err}')
        else:
            unused_files.extend([
                to_file_info(f, 'images/avatar') for f in unused_avatar
            ])

    # 이미지 캐시 정리
    if target in ('all', 'content'):
        cache_count, _ = service.clean_image_cache(used_content, not dry_run)
        if cache_count > 0:
            messages.append(f'이미지 캐시 {cache_count}개 정리')

    # 빈 디렉토리 정리
    if not dry_run:
        empty_dirs = 0
        if target in ('all', 'content'):
            empty_dirs += service.remove_empty_dirs(service.content_image_dir)
        if target in ('all', 'title'):
            empty_dirs += service.remove_empty_dirs(service.title_image_dir)
        if target in ('all', 'avatar'):
            empty_dirs += service.remove_empty_dirs(service.avatar_image_dir)
        if empty_dirs > 0:
            messages.append(f'빈 디렉토리 {empty_dirs}개 삭제')

    total_saved = total_size + total_duplicate_size

    result = {
        'total_unused': total_unused,
        'total_size_mb': round(total_size / (1024 * 1024), 2),
        'total_duplicates': total_duplicates,
        'total_duplicate_size_mb': round(total_duplicate_size / (1024 * 1024), 2),
        'total_saved_mb': round(total_saved / (1024 * 1024), 2),
        'messages': messages,
        'dry_run': dry_run,
    }

    if dry_run:
        result['unused_files'] = unused_files[:100]
        if duplicate_files:
            result['duplicate_files'] = duplicate_files[:100]

    return StatusDone(result)

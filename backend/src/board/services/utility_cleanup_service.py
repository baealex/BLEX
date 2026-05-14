from django.conf import settings
from django.contrib.admin.models import LogEntry
from django.contrib.sessions.models import Session

from board.admin.utilities import (
    DatabaseStatsService,
    ImageCleanerService,
    SessionCleanerService,
    TagCleanerService,
)
from board.modules.response import StatusError, ErrorCode


class InvalidImageCleanupTargetError(Exception):
    """Raised when a utility image cleanup target is not supported."""


class UtilityPermissionService:
    """Permission policy for staff-only utility endpoints."""

    @staticmethod
    def require_staff(user):
        if not user.is_active:
            return StatusError(ErrorCode.NEED_LOGIN)

        if not user.is_staff:
            return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

        return None


class UtilityCleanupService:
    """Build utility stats and cleanup dry-run/execute response contracts."""

    VALID_IMAGE_TARGETS = ('all', 'content', 'title', 'avatar')

    @staticmethod
    def get_stats() -> dict:
        stats = DatabaseStatsService.get_statistics()
        stats['log_count'] = LogEntry.objects.count()
        return stats

    @staticmethod
    def clean_tags(body: dict) -> dict:
        dry_run = body.get('dry_run', True)

        service = TagCleanerService()
        tag_stats = service.get_tag_statistics()
        count, tag_names = service.clean_unused_tags(execute=not dry_run)

        return {
            'total_tags': tag_stats['total_tags'],
            'used_tags': tag_stats['used_tags'],
            'unused_tags': tag_stats['unused_tags'],
            'top_tags': tag_stats['top_tags'],
            'cleaned_count': count,
            'cleaned_tags': tag_names[:20],
            'dry_run': dry_run,
        }

    @staticmethod
    def clean_sessions(body: dict) -> dict:
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

        return {
            'total_sessions': total_sessions,
            'expired_sessions': expired_sessions,
            'cleaned_count': cleaned_count,
            'clean_all': clean_all,
            'dry_run': dry_run,
        }

    @staticmethod
    def clean_logs(body: dict) -> dict:
        dry_run = body.get('dry_run', True)
        log_count = LogEntry.objects.count()
        cleaned_count = 0

        if not dry_run:
            LogEntry.objects.all().delete()
            cleaned_count = log_count

        return {
            'log_count': log_count,
            'cleaned_count': cleaned_count,
            'dry_run': dry_run,
        }

    @staticmethod
    def validate_image_target(target: str) -> None:
        if target not in UtilityCleanupService.VALID_IMAGE_TARGETS:
            raise InvalidImageCleanupTargetError('유효하지 않은 대상입니다.')

    @staticmethod
    def clean_images(body: dict) -> dict:
        dry_run = body.get('dry_run', True)
        target = body.get('target', 'all')
        remove_duplicates = body.get('remove_duplicates', False)

        UtilityCleanupService.validate_image_target(target)

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

        if target in ('all', 'content'):
            unused_content, unused_size = UtilityCleanupService.collect_unused_files(
                service,
                service.content_image_dir,
                used_content,
            )
            total_unused += len(unused_content)
            total_size += unused_size

            if not dry_run:
                UtilityCleanupService.clean_files_with_messages(
                    service,
                    unused_content,
                    messages,
                    '컨텐츠 이미지',
                )
            else:
                unused_files.extend([
                    UtilityCleanupService.to_file_info(f, 'images/content')
                    for f in unused_content
                ])

        if target in ('all', 'title'):
            unused_title, unused_size = UtilityCleanupService.collect_unused_files(
                service,
                service.title_image_dir,
                used_title,
            )
            total_unused += len(unused_title)
            total_size += unused_size

            if not dry_run:
                UtilityCleanupService.clean_files_with_messages(
                    service,
                    unused_title,
                    messages,
                    '타이틀 이미지',
                )
            else:
                unused_files.extend([
                    UtilityCleanupService.to_file_info(f, 'images/title')
                    for f in unused_title
                ])

            if remove_duplicates:
                duplicate_stats = UtilityCleanupService.handle_title_duplicates(
                    service,
                    dry_run,
                    messages,
                )
                total_duplicates += duplicate_stats['count']
                total_duplicate_size += duplicate_stats['size']
                duplicate_files.extend(duplicate_stats['files'])

        if target in ('all', 'avatar'):
            unused_avatar, unused_size = UtilityCleanupService.collect_unused_files(
                service,
                service.avatar_image_dir,
                used_avatar,
            )
            total_unused += len(unused_avatar)
            total_size += unused_size

            if not dry_run:
                UtilityCleanupService.clean_files_with_messages(
                    service,
                    unused_avatar,
                    messages,
                    '아바타 이미지',
                )
            else:
                unused_files.extend([
                    UtilityCleanupService.to_file_info(f, 'images/avatar')
                    for f in unused_avatar
                ])

        if target in ('all', 'content'):
            cache_count, _ = service.clean_image_cache(used_content, not dry_run)
            if cache_count > 0:
                messages.append(f'이미지 캐시 {cache_count}개 정리')

        if not dry_run:
            empty_dirs = UtilityCleanupService.remove_empty_dirs(service, target)
            if empty_dirs > 0:
                messages.append(f'빈 디렉토리 {empty_dirs}개 삭제')

        return UtilityCleanupService.build_image_result(
            total_unused=total_unused,
            total_size=total_size,
            total_duplicates=total_duplicates,
            total_duplicate_size=total_duplicate_size,
            messages=messages,
            dry_run=dry_run,
            unused_files=unused_files,
            duplicate_files=duplicate_files,
        )

    @staticmethod
    def collect_unused_files(service: ImageCleanerService, directory, used_images):
        files = service.scan_directory(directory, used_images)
        unused_files = [f for f in files if not f['is_used']]
        unused_size = sum(f['size'] for f in unused_files)
        return unused_files, unused_size

    @staticmethod
    def clean_files_with_messages(
        service: ImageCleanerService,
        files: list[dict],
        messages: list[str],
        label: str,
    ) -> None:
        count, errors = service.clean_files([f['path'] for f in files])
        messages.append(f'{label} {count}개 삭제 완료')
        for err in errors:
            messages.append(f'오류: {err}')

    @staticmethod
    def handle_title_duplicates(service: ImageCleanerService, dry_run: bool, messages: list[str]) -> dict:
        dup_count, dup_size, duplicates = service.find_and_remove_duplicates(
            service.title_image_dir,
            not dry_run,
        )
        if dup_count > 0:
            messages.append(
                f'중복 타이틀 이미지 {dup_count}개 '
                f'({round(dup_size / (1024 * 1024), 2)} MB)'
            )

        files = []
        if dry_run:
            files = [
                {
                    'duplicateUrl': d['duplicate_url'],
                    'duplicateSizeKb': d['duplicate_size_kb'],
                    'originalUrl': d['original_url'],
                    'originalSizeKb': d['original_size_kb'],
                    'hash': d['hash'],
                }
                for d in duplicates
            ]

        return {
            'count': dup_count,
            'size': dup_size,
            'files': files,
        }

    @staticmethod
    def remove_empty_dirs(service: ImageCleanerService, target: str) -> int:
        empty_dirs = 0
        if target in ('all', 'content'):
            empty_dirs += service.remove_empty_dirs(service.content_image_dir)
        if target in ('all', 'title'):
            empty_dirs += service.remove_empty_dirs(service.title_image_dir)
        if target in ('all', 'avatar'):
            empty_dirs += service.remove_empty_dirs(service.avatar_image_dir)
        return empty_dirs

    @staticmethod
    def to_file_info(file_dict: dict, media_prefix: str) -> dict:
        relative = file_dict['relative_path']
        return {
            'path': relative,
            'url': settings.MEDIA_URL + media_prefix + '/' + relative,
            'size_kb': file_dict['size_kb'],
        }

    @staticmethod
    def build_image_result(
        total_unused: int,
        total_size: int,
        total_duplicates: int,
        total_duplicate_size: int,
        messages: list[str],
        dry_run: bool,
        unused_files: list[dict],
        duplicate_files: list[dict],
    ) -> dict:
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

        return result

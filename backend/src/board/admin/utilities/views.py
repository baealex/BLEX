"""
유틸리티 뷰 메서드들
"""
from django.shortcuts import render
from django.http import HttpRequest, HttpResponse
from django.contrib.admin.models import LogEntry
from django.contrib.sessions.models import Session

from board.models import PostContent

from .result import UtilityResult
from .image_cleaner import ImageCleanerService
from .database import DatabaseStatsService, SessionCleanerService
from .tag_cleaner import TagCleanerService


def utility_dashboard_view(admin_site, request: HttpRequest) -> HttpResponse:
    """유틸리티 대시보드"""
    context = {
        **admin_site.each_context(request),
        'title': '유틸리티 관리',
    }
    return render(request, 'admin/utility_dashboard.html', context)


def clean_images_view(admin_site, request: HttpRequest) -> HttpResponse:
    """이미지 정리"""
    result = None

    if request.method == 'POST':
        execute = request.POST.get('execute') == 'true'
        target = request.POST.get('target', 'all')
        remove_duplicates = request.POST.get('remove_duplicates') == 'true'

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
        total_duplicates = 0
        total_duplicate_size = 0

        # 컨텐츠 이미지
        if target in ['all', 'content']:
            content_files = service.scan_directory(service.content_image_dir, used_content)
            unused_content = [f for f in content_files if not f['is_used']]
            result.add_statistic('unused_content_count', len(unused_content))

            # 통계 계산 (dry-run과 실행 모두)
            total_unused += len(unused_content)
            total_size += sum(f['size'] for f in unused_content)

            if execute:
                count, errors = service.clean_files([f['path'] for f in unused_content])
                result.add_message('success', f'컨텐츠 이미지 {count}개 삭제 완료')
                if errors:
                    for err in errors:
                        result.add_message('error', err)
            else:
                result.files.extend(unused_content)

        # 타이틀 이미지
        if target in ['all', 'title']:
            title_files = service.scan_directory(service.title_image_dir, used_title)
            unused_title = [f for f in title_files if not f['is_used']]
            result.add_statistic('unused_title_count', len(unused_title))

            # 통계 계산 (dry-run과 실행 모두)
            total_unused += len(unused_title)
            total_size += sum(f['size'] for f in unused_title)

            if execute:
                count, errors = service.clean_files([f['path'] for f in unused_title])
                result.add_message('success', f'타이틀 이미지 {count}개 삭제 완료')
                if errors:
                    for err in errors:
                        result.add_message('error', err)
            else:
                result.files.extend(unused_title)

            # 중복 타이틀 이미지 처리
            if remove_duplicates:
                dup_count, dup_size, duplicates = service.find_and_remove_duplicates(
                    service.title_image_dir, execute
                )
                total_duplicates += dup_count
                total_duplicate_size += dup_size
                result.add_statistic('duplicate_title_count', dup_count)

                if execute:
                    if dup_count > 0:
                        result.add_message('success',
                            f'중복 타이틀 이미지 {dup_count}개 삭제 완료 ({round(dup_size / (1024 * 1024), 2)} MB)')
                else:
                    if dup_count > 0:
                        result.add_message('info',
                            f'중복 타이틀 이미지 {dup_count}개 발견 ({round(dup_size / (1024 * 1024), 2)} MB)')
                        # 중복 파일 정보 추가 (최대 10개)
                        for dup in duplicates[:10]:
                            result.files.append({
                                'path': dup['duplicate_path'],
                                'relative_path': f"중복: {os.path.basename(dup['duplicate_path'])} → 원본: {os.path.basename(dup['original_path'])}",
                                'filename': os.path.basename(dup['duplicate_path']),
                                'is_used': False,
                                'size': dup['size'],
                                'size_kb': round(dup['size'] / 1024, 2)
                            })

        # 아바타 이미지
        if target in ['all', 'avatar']:
            avatar_files = service.scan_directory(service.avatar_image_dir, used_avatar)
            unused_avatar = [f for f in avatar_files if not f['is_used']]
            result.add_statistic('unused_avatar_count', len(unused_avatar))

            # 통계 계산 (dry-run과 실행 모두)
            total_unused += len(unused_avatar)
            total_size += sum(f['size'] for f in unused_avatar)

            if execute:
                count, errors = service.clean_files([f['path'] for f in unused_avatar])
                result.add_message('success', f'아바타 이미지 {count}개 삭제 완료')
                if errors:
                    for err in errors:
                        result.add_message('error', err)
            else:
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

        # 통계 추가
        result.add_statistic('total_unused', total_unused)
        result.add_statistic('total_size_mb', round(total_size / (1024 * 1024), 2))
        result.add_statistic('total_duplicates', total_duplicates)
        result.add_statistic('total_duplicate_size_mb', round(total_duplicate_size / (1024 * 1024), 2))

        # 총 절약 용량
        total_saved = total_size + total_duplicate_size
        result.add_statistic('total_saved_mb', round(total_saved / (1024 * 1024), 2))

    context = {
        **admin_site.each_context(request),
        'title': '이미지 정리',
        'result': result,
    }
    return render(request, 'admin/clean_images.html', context)


def clean_logs_view(admin_site, request: HttpRequest) -> HttpResponse:
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
        **admin_site.each_context(request),
        'title': '로그 정리',
        'result': result,
    }
    return render(request, 'admin/clean_logs.html', context)


def database_stats_view(admin_site, request: HttpRequest) -> HttpResponse:
    """데이터베이스 통계"""
    service = DatabaseStatsService()
    stats = service.get_statistics()

    context = {
        **admin_site.each_context(request),
        'title': '데이터베이스 통계',
        'stats': stats,
    }
    return render(request, 'admin/database_stats.html', context)


def clean_sessions_view(admin_site, request: HttpRequest) -> HttpResponse:
    """세션 정리"""
    result = None

    if request.method == 'POST':
        execute = request.POST.get('execute') == 'true'
        clean_all = request.POST.get('clean_all') == 'true'

        service = SessionCleanerService()
        result = UtilityResult()

        if clean_all:
            # 모든 세션 삭제
            total_count = service.count_expired_sessions()
            all_count = Session.objects.count()
            result.add_statistic('total_sessions', all_count)
            result.add_statistic('expired_sessions', total_count)

            if execute:
                deleted = service.clean_all_sessions()
                result.add_message('success', f'모든 세션 {deleted}개 삭제 완료')
                result.add_message('warning', '모든 사용자가 로그아웃됩니다.')
            else:
                result.add_message('warning', f'모든 세션 {all_count}개가 삭제됩니다.')
                result.add_message('warning', '모든 사용자가 로그아웃됩니다.')
        else:
            # 만료된 세션만 삭제
            expired_count = service.count_expired_sessions()
            result.add_statistic('expired_sessions', expired_count)

            if execute:
                deleted = service.clean_expired_sessions()
                result.add_message('success', f'만료된 세션 {deleted}개 삭제 완료')
            else:
                result.add_message('info', f'삭제 예정: {expired_count}개의 만료된 세션')

    context = {
        **admin_site.each_context(request),
        'title': '세션 정리',
        'result': result,
    }
    return render(request, 'admin/clean_sessions.html', context)


def clean_tags_view(admin_site, request: HttpRequest) -> HttpResponse:
    """태그 정리"""
    result = None

    if request.method == 'POST':
        execute = request.POST.get('execute') == 'true'

        service = TagCleanerService()
        result = UtilityResult()

        # 태그 통계
        stats = service.get_tag_statistics()
        for key, value in stats.items():
            result.add_statistic(key, value)

        # 미사용 태그 삭제
        count, tag_names = service.clean_unused_tags(execute)

        if execute:
            if count > 0:
                result.add_message('success', f'{count}개의 미사용 태그를 삭제했습니다.')
                # 삭제된 태그 목록 (최대 20개)
                if tag_names:
                    result.add_statistic('deleted_tags', tag_names[:20])
            else:
                result.add_message('info', '삭제할 미사용 태그가 없습니다.')
        else:
            if count > 0:
                result.add_message('info', f'{count}개의 미사용 태그를 발견했습니다.')
                # 미사용 태그 목록 (최대 20개)
                unused_tags = service.get_unused_tags()
                result.add_statistic('unused_tag_list', unused_tags[:20])
            else:
                result.add_message('info', '미사용 태그가 없습니다.')

    context = {
        **admin_site.each_context(request),
        'title': '태그 정리',
        'result': result,
    }
    return render(request, 'admin/clean_tags.html', context)

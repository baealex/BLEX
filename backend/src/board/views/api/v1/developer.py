from django.shortcuts import get_object_or_404
from django.core.paginator import Paginator

from board.models import DeveloperWebhook, DeveloperWebhookLog
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.constants.webhook_events import (
    WEBHOOK_EVENT,
    WEBHOOK_PROVIDER,
    WEBHOOK_EVENT_DESCRIPTIONS,
    WEBHOOK_PROVIDER_DESCRIPTIONS,
)
from modules.webhook import WebhookService


def webhooks(request, webhook_id=None):
    """웹훅 관리 API"""
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    # 웹훅 목록 조회
    if request.method == 'GET' and webhook_id is None:
        webhooks = DeveloperWebhook.objects.filter(
            user=request.user
        ).order_by('-created_date')

        # 페이지네이션
        page = int(request.GET.get('page', 1))
        paginator = Paginator(webhooks, 20)
        page_obj = paginator.get_page(page)

        return StatusDone({
            'webhooks': [{
                'id': webhook.id,
                'name': webhook.name,
                'url': webhook.url,
                'provider': webhook.provider,
                'events': webhook.events,
                'is_active': webhook.is_active,
                'created_date': webhook.created_date.isoformat(),
                'updated_date': webhook.updated_date.isoformat(),
            } for webhook in page_obj],
            'total': paginator.count,
            'has_next': page_obj.has_next(),
        })

    # 웹훅 생성
    elif request.method == 'POST' and webhook_id is None:
        name = request.POST.get('name', '').strip()
        url = request.POST.get('url', '').strip()
        provider = request.POST.get('provider', 'generic').strip()
        events = request.POST.getlist('events')
        is_active = request.POST.get('is_active', 'true').lower() == 'true'
        secret = request.POST.get('secret', '').strip()

        # 검증
        if not name:
            return StatusError(ErrorCode.REQUIRE, message='웹훅 이름을 입력해주세요.')
        if not url:
            return StatusError(ErrorCode.REQUIRE, message='웹훅 URL을 입력해주세요.')
        if not url.startswith(('http://', 'https://')):
            return StatusError(ErrorCode.VALIDATE, message='올바른 URL 형식이 아닙니다.')
        if provider not in [p.value for p in WEBHOOK_PROVIDER]:
            return StatusError(ErrorCode.VALIDATE, message='올바른 제공자 타입이 아닙니다.')
        if not events:
            return StatusError(ErrorCode.REQUIRE, message='구독할 이벤트를 선택해주세요.')

        # 유효한 이벤트인지 확인
        valid_events = [e.value for e in WEBHOOK_EVENT]
        for event in events:
            if event not in valid_events:
                return StatusError(ErrorCode.VALIDATE, message='올바른 이벤트 타입이 아닙니다.')

        # 웹훅 생성
        webhook = DeveloperWebhook.objects.create(
            user=request.user,
            name=name,
            url=url,
            provider=provider,
            events=events,
            is_active=is_active,
            secret=secret,
        )

        return StatusDone({
            'id': webhook.id,
            'message': '웹훅이 생성되었습니다.'
        })

    # 웹훅 상세 조회
    elif request.method == 'GET' and webhook_id:
        webhook = get_object_or_404(
            DeveloperWebhook,
            id=webhook_id,
            user=request.user
        )

        return StatusDone({
            'id': webhook.id,
            'name': webhook.name,
            'url': webhook.url,
            'provider': webhook.provider,
            'events': webhook.events,
            'is_active': webhook.is_active,
            'secret': webhook.secret,
            'created_date': webhook.created_date.isoformat(),
            'updated_date': webhook.updated_date.isoformat(),
        })

    # 웹훅 수정
    elif request.method == 'PUT' and webhook_id:
        webhook = get_object_or_404(
            DeveloperWebhook,
            id=webhook_id,
            user=request.user
        )

        # PUT 데이터 파싱
        import json
        try:
            data = json.loads(request.body)
        except:
            return StatusError(ErrorCode.REJECT, message='올바른 JSON 형식이 아닙니다.')

        # 필드 업데이트
        if 'name' in data:
            webhook.name = data['name'].strip()
        if 'url' in data:
            url = data['url'].strip()
            if not url.startswith(('http://', 'https://')):
                return StatusError(ErrorCode.VALIDATE, message='올바른 URL 형식이 아닙니다.')
            webhook.url = url
        if 'provider' in data:
            provider = data['provider']
            if provider not in [p.value for p in WEBHOOK_PROVIDER]:
                return StatusError(ErrorCode.VALIDATE, message='올바른 제공자 타입이 아닙니다.')
            webhook.provider = provider
        if 'events' in data:
            events = data['events']
            valid_events = [e.value for e in WEBHOOK_EVENT]
            for event in events:
                if event not in valid_events:
                    return StatusError(ErrorCode.VALIDATE, message='올바른 이벤트 타입이 아닙니다.')
            webhook.events = events
        if 'is_active' in data:
            webhook.is_active = data['is_active']
        if 'secret' in data:
            webhook.secret = data['secret']

        webhook.save()

        return StatusDone({
            'id': webhook.id,
            'message': '웹훅이 수정되었습니다.'
        })

    # 웹훅 삭제
    elif request.method == 'DELETE' and webhook_id:
        webhook = get_object_or_404(
            DeveloperWebhook,
            id=webhook_id,
            user=request.user
        )

        webhook.delete()

        return StatusDone({
            'message': '웹훅이 삭제되었습니다.'
        })

    return StatusError(ErrorCode.REJECT)


def webhook_logs(request, webhook_id):
    """웹훅 로그 조회"""
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    webhook = get_object_or_404(
        DeveloperWebhook,
        id=webhook_id,
        user=request.user
    )

    if request.method == 'GET':
        logs = DeveloperWebhookLog.objects.filter(
            webhook=webhook
        ).order_by('-created_date')

        # 페이지네이션
        page = int(request.GET.get('page', 1))
        paginator = Paginator(logs, 50)
        page_obj = paginator.get_page(page)

        return StatusDone({
            'logs': [{
                'id': log.id,
                'event': log.event,
                'status_code': log.status_code,
                'error': log.error,
                'retry_count': log.retry_count,
                'created_date': log.created_date.isoformat(),
            } for log in page_obj],
            'total': paginator.count,
            'has_next': page_obj.has_next(),
        })

    return StatusError(ErrorCode.REJECT)


def webhook_test(request, webhook_id):
    """웹훅 테스트 전송"""
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    webhook = get_object_or_404(
        DeveloperWebhook,
        id=webhook_id,
        user=request.user
    )

    if request.method == 'POST':
        # 테스트 데이터 전송
        test_data = {
            'title': '테스트 웹훅',
            'content': '이것은 테스트 웹훅입니다.',
            'url': 'https://blex.me',
        }

        # 첫 번째 이벤트로 테스트 전송
        event = webhook.events[0] if webhook.events else WEBHOOK_EVENT.POST_PUBLISHED.value

        success = WebhookService.send_webhook(webhook, event, test_data)

        if success:
            return StatusDone({
                'message': '테스트 웹훅이 전송되었습니다.'
            })
        else:
            return StatusError(ErrorCode.REJECT, message='웹훅 전송에 실패했습니다.')

    return StatusError(ErrorCode.REJECT, message='지원하지 않는 HTTP 메서드입니다.')


def webhook_events_info(request):
    """웹훅 이벤트 정보 조회 (설정 UI에서 사용)"""
    if request.method == 'GET':
        return StatusDone({
            'events': [
                {
                    'value': event.value,
                    'description': WEBHOOK_EVENT_DESCRIPTIONS.get(event.value, '')
                }
                for event in WEBHOOK_EVENT
            ],
            'providers': [
                {
                    'value': provider.value,
                    'description': WEBHOOK_PROVIDER_DESCRIPTIONS.get(provider.value, '')
                }
                for provider in WEBHOOK_PROVIDER
            ]
        })

    return StatusError(ErrorCode.REJECT)

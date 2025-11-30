import json
import time
import requests

from board.constants.webhook_events import WEBHOOK_EVENT, WEBHOOK_PROVIDER


class WebhookService:
    """웹훅 전송 서비스"""

    MAX_RETRIES = 3
    RETRY_DELAY = 2  # 초

    @staticmethod
    def format_payload_for_discord(event, data):
        """Discord 웹훅용 페이로드 포맷팅"""
        if event == WEBHOOK_EVENT.POST_PUBLISHED.value:
            return {
                'content': f"📝 새 글이 발행되었습니다!\n\n**{data.get('title', '')}**\n{data.get('url', '')}"
            }
        elif event == WEBHOOK_EVENT.NOTIFY_CREATED.value:
            return {
                'content': f"🔔 새 알림이 도착했습니다!\n\n{data.get('content', '')}\n{data.get('url', '')}"
            }
        elif event == WEBHOOK_EVENT.COMMENT_CREATED.value:
            return {
                'content': f"💬 새 댓글이 작성되었습니다!\n\n{data.get('content', '')}\n{data.get('url', '')}"
            }
        elif event == WEBHOOK_EVENT.COMMENT_LIKED.value:
            return {
                'content': f"👍 댓글에 좋아요가 눌렸습니다!\n\n{data.get('url', '')}"
            }
        elif event == WEBHOOK_EVENT.POST_LIKED.value:
            return {
                'content': f"❤️ 글에 좋아요가 눌렸습니다!\n\n{data.get('title', '')}\n{data.get('url', '')}"
            }
        return {'content': json.dumps(data, ensure_ascii=False)}

    @staticmethod
    def format_payload_for_slack(event, data):
        """Slack 웹훅용 페이로드 포맷팅"""
        if event == WEBHOOK_EVENT.POST_PUBLISHED.value:
            return {
                'text': f"📝 새 글이 발행되었습니다!",
                'blocks': [
                    {
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': f"*{data.get('title', '')}*"
                        }
                    },
                    {
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': f"<{data.get('url', '')}|글 보러가기>"
                        }
                    }
                ]
            }
        elif event == WEBHOOK_EVENT.NOTIFY_CREATED.value:
            return {
                'text': f"🔔 새 알림",
                'blocks': [
                    {
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': data.get('content', '')
                        }
                    },
                    {
                        'type': 'section',
                        'text': {
                            'type': 'mrkdwn',
                            'text': f"<{data.get('url', '')}|자세히 보기>"
                        }
                    }
                ]
            }
        # 기타 이벤트는 간단한 텍스트로
        return {'text': json.dumps(data, ensure_ascii=False)}

    @staticmethod
    def format_payload(provider, event, data):
        """provider에 따라 페이로드 포맷팅"""
        if provider == WEBHOOK_PROVIDER.DISCORD.value:
            return WebhookService.format_payload_for_discord(event, data)
        elif provider == WEBHOOK_PROVIDER.SLACK.value:
            return WebhookService.format_payload_for_slack(event, data)
        else:
            # generic webhook
            return {
                'event': event,
                'data': data
            }

    @staticmethod
    def send_webhook(webhook, event, data):
        """
        웹훅 전송 (재시도 포함)

        Args:
            webhook: DeveloperWebhook 인스턴스
            event: 이벤트 타입 (WEBHOOK_EVENT)
            data: 전송할 데이터 (dict)

        Returns:
            bool: 성공 여부
        """
        from board.models import DeveloperWebhookLog

        if not webhook.is_active:
            return False

        payload = WebhookService.format_payload(webhook.provider, event, data)
        payload_str = json.dumps(payload, ensure_ascii=False)

        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'BLEX-Webhook/1.0'
        }

        # secret이 있으면 헤더에 추가
        if webhook.secret:
            headers['X-Webhook-Secret'] = webhook.secret

        last_error = None
        last_status_code = None
        last_response = ''

        # 최대 3번 재시도
        for retry_count in range(WebhookService.MAX_RETRIES):
            try:
                response = requests.post(
                    webhook.url,
                    data=payload_str,
                    headers=headers,
                    timeout=10
                )

                last_status_code = response.status_code
                last_response = response.text[:1000]  # 응답은 최대 1000자까지만 저장

                # 성공 (2xx)
                if 200 <= response.status_code < 300:
                    DeveloperWebhookLog.objects.create(
                        webhook=webhook,
                        event=event,
                        payload=payload_str,
                        status_code=last_status_code,
                        response=last_response,
                        retry_count=retry_count
                    )
                    return True

                # 4xx 에러는 재시도하지 않음 (클라이언트 에러)
                if 400 <= response.status_code < 500:
                    last_error = f"Client error: {response.status_code}"
                    break

                # 5xx 에러는 재시도
                last_error = f"Server error: {response.status_code}"

            except requests.exceptions.Timeout:
                last_error = "Request timeout"
            except requests.exceptions.ConnectionError:
                last_error = "Connection error"
            except Exception as e:
                last_error = str(e)

            # 마지막 시도가 아니면 대기 후 재시도
            if retry_count < WebhookService.MAX_RETRIES - 1:
                time.sleep(WebhookService.RETRY_DELAY)

        # 실패 로그 저장
        DeveloperWebhookLog.objects.create(
            webhook=webhook,
            event=event,
            payload=payload_str,
            status_code=last_status_code,
            response=last_response,
            error=last_error,
            retry_count=WebhookService.MAX_RETRIES
        )
        return False

    @staticmethod
    def trigger_event(event, data, user=None):
        """
        특정 이벤트를 구독한 모든 웹훅 전송

        Args:
            event: 이벤트 타입 (WEBHOOK_EVENT.*.value)
            data: 전송할 데이터
            user: 특정 사용자의 웹훅만 전송 (None이면 모든 사용자)
        """
        from board.models import DeveloperWebhook
        from modules.sub_task import SubTaskProcessor

        # 활성화된 웹훅 중 해당 이벤트를 구독한 웹훅 찾기
        webhooks = DeveloperWebhook.objects.filter(
            is_active=True,
            events__contains=event
        )

        if user:
            webhooks = webhooks.filter(user=user)

        # 각 웹훅에 비동기로 전송
        for webhook in webhooks:
            SubTaskProcessor.process(
                WebhookService.send_webhook,
                webhook,
                event,
                data
            )

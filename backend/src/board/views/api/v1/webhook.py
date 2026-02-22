"""
Webhook Channel API

Endpoints for authors to manage their notification channels.
When a new post is published, notifications are sent to:
- the author's channels
- global channels (staff-managed)
"""
import json

from django.views.decorators.http import require_http_methods

from board.models import Profile, WebhookSubscription, SiteContentScope
from board.services import WebhookService
from board.modules.response import StatusDone, StatusError, ErrorCode


def _get_authenticated_profile(request):
    """Get the authenticated user's profile or return error response."""
    if not request.user.is_authenticated:
        return None, StatusError(ErrorCode.NEED_LOGIN, 'Login required')

    try:
        profile = Profile.objects.get(user=request.user)
        return profile, None
    except Profile.DoesNotExist:
        return None, StatusError(ErrorCode.NOT_FOUND, 'Profile not found')


def _validate_webhook_payload(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return None, None, StatusError(ErrorCode.INVALID_PARAMETER, 'Invalid JSON body')

    webhook_url = data.get('webhook_url', '').strip()
    name = data.get('name', '').strip()

    if not webhook_url:
        return None, None, StatusError(ErrorCode.REQUIRE, 'webhook_url is required')

    if not webhook_url.startswith(('http://', 'https://')):
        return None, None, StatusError(ErrorCode.VALIDATE, 'Invalid webhook URL')

    if len(webhook_url) > 500:
        return None, None, StatusError(ErrorCode.SIZE_OVERFLOW, 'Webhook URL is too long')

    return webhook_url, name, None


def _ensure_staff(request):
    if not request.user.is_authenticated:
        return StatusError(ErrorCode.NEED_LOGIN, 'Login required')
    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')
    return None


@require_http_methods(['GET', 'POST'])
def my_channels(request):
    """
    Manage my notification channels (webhooks).

    GET /api/v1/webhook/channels/
    Returns: { channels: [{ id, name, webhook_url, is_active, failure_count, created_date }] }

    POST /api/v1/webhook/channels/
    Body: { webhook_url: string, name?: string }
    Returns: { success: true, channel_id: number }
    """
    profile, error = _get_authenticated_profile(request)
    if error:
        return error

    if request.method == 'GET':
        channels = WebhookSubscription.objects.filter(
            scope=SiteContentScope.USER,
            author=profile
        ).values('id', 'name', 'webhook_url', 'is_active', 'failure_count', 'created_date')

        return StatusDone({
            'channels': list(channels)
        })

    webhook_url, name, error = _validate_webhook_payload(request)
    if error:
        return error

    channel = WebhookService.create_subscription(
        author=profile,
        webhook_url=webhook_url,
        name=name
    )

    return StatusDone({
        'success': True,
        'channel_id': channel.id
    })


@require_http_methods(['DELETE'])
def delete_channel(request, channel_id):
    """
    Delete a notification channel.

    DELETE /api/v1/webhook/channels/{channel_id}/
    Returns: { success: true }
    """
    profile, error = _get_authenticated_profile(request)
    if error:
        return error

    try:
        channel = WebhookSubscription.objects.get(
            id=channel_id,
            scope=SiteContentScope.USER,
            author=profile
        )
        channel.delete()
        return StatusDone({'success': True})
    except WebhookSubscription.DoesNotExist:
        return StatusError(ErrorCode.NOT_FOUND, 'Channel not found')


@require_http_methods(['GET', 'POST'])
def global_channels(request):
    """
    Manage global notification channels (staff only).

    GET /api/v1/webhook/global-channels/
    Returns: { channels: [{ id, name, webhook_url, is_active, failure_count, created_date }] }

    POST /api/v1/webhook/global-channels/
    Body: { webhook_url: string, name?: string }
    Returns: { success: true, channel_id: number }
    """
    staff_error = _ensure_staff(request)
    if staff_error:
        return staff_error

    if request.method == 'GET':
        channels = WebhookSubscription.objects.filter(
            scope=SiteContentScope.GLOBAL
        ).values('id', 'name', 'webhook_url', 'is_active', 'failure_count', 'created_date')

        return StatusDone({
            'channels': list(channels)
        })

    webhook_url, name, error = _validate_webhook_payload(request)
    if error:
        return error

    channel = WebhookService.create_global_subscription(
        webhook_url=webhook_url,
        name=name
    )

    return StatusDone({
        'success': True,
        'channel_id': channel.id
    })


@require_http_methods(['DELETE'])
def delete_global_channel(request, channel_id):
    """
    Delete a global notification channel (staff only).

    DELETE /api/v1/webhook/global-channels/{channel_id}/
    Returns: { success: true }
    """
    staff_error = _ensure_staff(request)
    if staff_error:
        return staff_error

    try:
        channel = WebhookSubscription.objects.get(
            id=channel_id,
            scope=SiteContentScope.GLOBAL
        )
        channel.delete()
        return StatusDone({'success': True})
    except WebhookSubscription.DoesNotExist:
        return StatusError(ErrorCode.NOT_FOUND, 'Channel not found')


@require_http_methods(['POST'])
def test_channel(request):
    """
    Test a webhook URL by sending a test message.

    POST /api/v1/webhook/test/
    Body: { webhook_url: string }
    Returns: { success: true/false }
    """
    profile, error = _get_authenticated_profile(request)
    if error:
        return error

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return StatusError(ErrorCode.INVALID_PARAMETER, 'Invalid JSON body')

    webhook_url = data.get('webhook_url', '').strip()

    if not webhook_url:
        return StatusError(ErrorCode.REQUIRE, 'webhook_url is required')

    if not webhook_url.startswith(('http://', 'https://')):
        return StatusError(ErrorCode.VALIDATE, 'Invalid webhook URL')

    success = WebhookService.test_webhook(webhook_url)

    return StatusDone({'success': success})

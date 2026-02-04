"""
Webhook Channel API

Endpoints for authors to manage their notification channels.
When a new post is published, notifications are sent to all registered webhooks.
"""
import json

from django.views.decorators.http import require_http_methods

from board.models import Profile, WebhookSubscription
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
            author=profile
        ).values('id', 'name', 'webhook_url', 'is_active', 'failure_count', 'created_date')

        return StatusDone({
            'channels': list(channels)
        })

    # POST - Add new channel
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return StatusError(ErrorCode.INVALID_PARAMETER, 'Invalid JSON body')

    webhook_url = data.get('webhook_url', '').strip()
    name = data.get('name', '').strip()

    if not webhook_url:
        return StatusError(ErrorCode.REQUIRE, 'webhook_url is required')

    if not webhook_url.startswith(('http://', 'https://')):
        return StatusError(ErrorCode.VALIDATE, 'Invalid webhook URL')

    if len(webhook_url) > 500:
        return StatusError(ErrorCode.SIZE_OVERFLOW, 'Webhook URL is too long')

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
        channel = WebhookSubscription.objects.get(id=channel_id, author=profile)
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

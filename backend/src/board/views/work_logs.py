from urllib.parse import urlencode
from uuid import UUID

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Page, Paginator
from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponse, HttpResponseBase
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.cache import add_never_cache_headers
from django.utils.translation import gettext as _
from django.views.decorators.http import require_http_methods, require_POST, require_safe

from board.models.work_logs import WorkLog, WorkLogEntry, WorkLogShare
from board.services.authoring_permission_service import AuthoringPermissionService
from board.services.site_url_service import SiteUrlService
from board.services.work_log_service import WorkLogService
from board.work_log_forms import WorkLogEntryForm, WorkLogForm, WorkLogShareForm
from board.work_log_media import WorkLogMedia


class WorkLogPages:
    @staticmethod
    def unlisted(response: HttpResponseBase) -> HttpResponseBase:
        add_never_cache_headers(response)
        response['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
        response['Referrer-Policy'] = 'strict-origin'
        return response

    @staticmethod
    def owned_log(request: HttpRequest, pk: int) -> WorkLog:
        if not request.user.is_active:
            raise PermissionDenied
        return get_object_or_404(WorkLog, pk=pk, owner=request.user)

    @staticmethod
    def require_editor(request: HttpRequest) -> None:
        if not AuthoringPermissionService.is_active_editor(request.user):
            raise PermissionDenied

    @staticmethod
    def get_share(token: UUID) -> WorkLogShare:
        return get_object_or_404(
            WorkLogShare.objects.select_related('log__owner'),
            token=token,
            log__owner__is_active=True,
        )

    @staticmethod
    def navigation(
        current: Page, path: str, parameter: str = 'page', **other_pages: int,
    ) -> dict[str, str]:
        links = {}
        if current.has_previous():
            query = urlencode({**other_pages, parameter: current.previous_page_number()})
            links['previous'] = f'{path}?{query}'
        if current.has_next():
            query = urlencode({**other_pages, parameter: current.next_page_number()})
            links['next'] = f'{path}?{query}'
        return links

    @staticmethod
    def encode_selection(entry_ids: set[int]) -> str:
        return ','.join(str(pk) for pk in sorted(entry_ids))

    @staticmethod
    def detail(
        request: HttpRequest,
        log: WorkLog,
        entry_form: WorkLogEntryForm | None = None,
        share_form: WorkLogShareForm | None = None,
        selected_ids: set[int] | None = None,
    ) -> HttpResponseBase:
        selected_ids = selected_ids or set()
        entry_pages = Paginator(WorkLogService.list_entries(log), WorkLogService.page_size)
        timeline = entry_pages.get_page(request.POST.get('timeline_page', request.GET.get('page')))
        selector = entry_pages.get_page(
            request.POST.get('selection_page', request.POST.get('current_selection_page', timeline.number)),
        )
        if timeline.number == selector.number:
            selector = timeline
        shares = Paginator(
            log.shares.order_by('-created_at', '-pk'), WorkLogService.page_size,
        ).get_page(request.POST.get('links_page', request.GET.get('links_page')))
        detail_path = reverse('work_log_detail', args=[log.pk])
        visible_ids = {entry.pk for entry in selector} if selected_ids else set()
        return WorkLogPages.unlisted(render(request, 'board/work_logs/detail.html', {
            'log': log,
            'can_write': AuthoringPermissionService.is_active_editor(request.user),
            'timeline': timeline,
            'timeline_links': WorkLogPages.navigation(timeline, detail_path, links_page=shares.number),
            'selector': selector,
            'shares': shares,
            'share_links': WorkLogPages.navigation(shares, detail_path, 'links_page', page=timeline.number),
            'entry_form': entry_form or WorkLogEntryForm(),
            'share_form': share_form or WorkLogShareForm(),
            'selected_ids': selected_ids,
            'saved_selection': WorkLogPages.encode_selection(selected_ids - visible_ids),
        }))

    @staticmethod
    def presentation(
        request: HttpRequest,
        log: WorkLog,
        headline: str,
        entries: QuerySet[WorkLogEntry],
        share: WorkLogShare | None = None,
        selected_ids: set[int] | None = None,
    ) -> HttpResponseBase:
        attachments = entries.exclude(attachment='')
        cover = attachments.last()
        image = attachments.filter(media_type__startswith='image/').last() if share else None
        share_path = reverse('work_log_shared', args=[share.token]) if share else ''
        new_link = share and request.GET.get('new') == '1' and log.owner == request.user
        page_number = request.GET.get('page') if share else request.POST.get('preview_page')
        timeline = Paginator(entries, WorkLogService.page_size).get_page(page_number)
        return WorkLogPages.unlisted(render(request, 'board/work_logs/shared.html', {
            'log': log,
            'headline': headline,
            'timeline': timeline,
            'timeline_links': WorkLogPages.navigation(timeline, share_path) if share else {},
            'cover': cover,
            'share': share,
            'selected_entries': WorkLogPages.encode_selection(selected_ids or set()),
            'return_page': request.POST.get('timeline_page', '1'),
            'selection_page': request.POST.get('current_selection_page', '1'),
            'links_page': request.POST.get('links_page', '1'),
            'share_url': SiteUrlService.absolute_url(request, share_path) if share else '',
            'image_url': (
                SiteUrlService.absolute_url(
                    request, reverse('work_log_shared_media', args=[share.token, image.pk]),
                ) if image else ''
            ),
            'new_link': new_link,
        }))


@login_required
@require_http_methods(['GET', 'POST'])
def work_logs(request: HttpRequest) -> HttpResponseBase:
    if not request.user.is_active:
        raise PermissionDenied
    can_write = AuthoringPermissionService.is_active_editor(request.user)
    if request.method == 'POST' and not can_write:
        raise PermissionDenied
    form = WorkLogForm(request.POST if request.method == 'POST' else None)
    if request.method == 'POST' and form.is_valid():
        log = WorkLog.objects.create(owner=request.user, title=form.cleaned_data['title'])
        return redirect('work_log_detail', pk=log.pk)
    logs = Paginator(WorkLogService.list_logs(request.user), WorkLogService.page_size).get_page(request.GET.get('page'))
    logs.object_list = list(logs.object_list)
    WorkLogService.attach_entry_counts(logs.object_list)
    return WorkLogPages.unlisted(render(request, 'board/work_logs/index.html', {
        'can_write': can_write,
        'form': form,
        'logs': logs,
        'log_links': WorkLogPages.navigation(logs, reverse('work_logs')),
    }))


@login_required
@require_safe
def work_log_detail(request: HttpRequest, pk: int) -> HttpResponseBase:
    return WorkLogPages.detail(request, WorkLogPages.owned_log(request, pk))


@login_required
@require_POST
def work_log_add_entry(request: HttpRequest, pk: int) -> HttpResponseBase:
    log = WorkLogPages.owned_log(request, pk)
    WorkLogPages.require_editor(request)
    form = WorkLogEntryForm(request.POST, request.FILES)
    if form.is_valid():
        WorkLogService.add_entry(log, **form.cleaned_data)
        return redirect('work_log_detail', pk=log.pk)
    return WorkLogPages.detail(request, log, entry_form=form)


@login_required
@require_POST
def work_log_publish_share(request: HttpRequest, pk: int) -> HttpResponseBase:
    log = WorkLogPages.owned_log(request, pk)
    WorkLogPages.require_editor(request)
    action = request.POST.get('action')
    browsing = 'selection_page' in request.POST or action == 'edit'
    form = WorkLogShareForm(request.POST, browsing=browsing)
    valid_form = form.is_valid()
    ids = form.cleaned_data.get('selected_entries', set())
    if not valid_form or browsing:
        return WorkLogPages.detail(request, log, share_form=form, selected_ids=ids)

    selected = WorkLogService.selected_entries(log, ids)
    headline = form.cleaned_data['headline']
    if action == 'publish':
        try:
            share = WorkLogService.create_share(log, headline, ids)
        except ValidationError as error:
            form.add_error('selected_entries', error)
        else:
            return redirect(reverse('work_log_shared', args=[share.token]) + '?new=1')
    elif selected.count() == len(ids):
        return WorkLogPages.presentation(request, log, headline, selected, selected_ids=ids)

    else:
        form.add_error('selected_entries', _('Choose entries from this work log.'))
    safe_ids = set(selected.values_list('pk', flat=True))
    return WorkLogPages.detail(request, log, share_form=form, selected_ids=safe_ids)


@login_required
@require_POST
def work_log_revoke_share(request: HttpRequest, pk: int, token: UUID) -> HttpResponse:
    log = WorkLogPages.owned_log(request, pk)
    get_object_or_404(log.shares, token=token).delete()
    return redirect('work_log_detail', pk=log.pk)


@login_required
@require_http_methods(['GET', 'POST'])
def work_log_delete(request: HttpRequest, pk: int) -> HttpResponseBase:
    log = WorkLogPages.owned_log(request, pk)
    if request.method == 'POST':
        log.delete()
        return redirect('work_logs')
    return WorkLogPages.unlisted(render(request, 'board/work_logs/confirm_delete.html', {'log': log}))


@login_required
@require_http_methods(['GET', 'POST'])
def work_log_delete_entry(request: HttpRequest, pk: int, entry_id: int) -> HttpResponseBase:
    log = WorkLogPages.owned_log(request, pk)
    entry = get_object_or_404(log.entries, pk=entry_id)
    if request.method == 'POST':
        WorkLogService.delete_entry(entry)
        return redirect('work_log_detail', pk=log.pk)
    return WorkLogPages.unlisted(render(request, 'board/work_logs/confirm_delete.html', {
        'log': log,
        'entry': entry,
    }))


@login_required
@require_safe
def work_log_private_media(request: HttpRequest, pk: int, entry_id: int) -> HttpResponseBase:
    log = WorkLogPages.owned_log(request, pk)
    entry = get_object_or_404(log.entries.exclude(attachment=''), pk=entry_id)
    return WorkLogPages.unlisted(WorkLogMedia.response(request, entry))


@require_safe
def work_log_shared(request: HttpRequest, token: UUID) -> HttpResponseBase:
    share = WorkLogPages.get_share(token)
    return WorkLogPages.presentation(
        request, share.log, share.headline, WorkLogService.shared_entries(share), share,
    )


@require_safe
def work_log_shared_media(request: HttpRequest, token: UUID, entry_id: int) -> HttpResponseBase:
    share = WorkLogPages.get_share(token)
    entry = get_object_or_404(share.entries.exclude(attachment=''), log=share.log, pk=entry_id)
    return WorkLogPages.unlisted(WorkLogMedia.response(request, entry))

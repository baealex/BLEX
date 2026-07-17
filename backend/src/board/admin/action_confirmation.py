from django.contrib.admin import helpers
from django.http import HttpRequest
from django.template.response import TemplateResponse


def render_action_confirmation(
    request: HttpRequest,
    model_admin,
    queryset,
    *,
    action_name: str,
    title: str,
    warning: str,
    confirm_label: str,
    is_destructive: bool = True,
) -> TemplateResponse:
    """Render a reusable confirmation step for high-impact Admin actions."""
    object_count = queryset.count()
    context = {
        **model_admin.admin_site.each_context(request),
        'title': title,
        'warning': warning,
        'confirm_label': confirm_label,
        'confirm_button_class': 'deletelink' if is_destructive else 'default',
        'object_count': object_count,
        'object_preview': list(queryset[:20]),
        'has_more_objects': object_count > 20,
        'selected_ids': request.POST.getlist(
            helpers.ACTION_CHECKBOX_NAME,
        ),
        'action_checkbox_name': helpers.ACTION_CHECKBOX_NAME,
        'action_name': action_name,
        'select_across': request.POST.get('select_across', '0'),
        'opts': model_admin.model._meta,
    }
    return TemplateResponse(
        request,
        'admin/board/confirm_action.html',
        context,
    )

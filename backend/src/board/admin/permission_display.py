from django.contrib.auth.models import Permission
from django.utils.translation import pgettext


DEFAULT_PERMISSION_ACTIONS = {
    'add': 'Add',
    'change': 'Change',
    'delete': 'Delete',
    'view': 'View',
}


def permission_choice_label(permission: Permission) -> str:
    """Render built-in permissions from stable codenames at request time."""
    action, separator, model_name = permission.codename.partition('_')
    model = permission.content_type.model_class()
    if (
        separator
        and model is not None
        and action in DEFAULT_PERMISSION_ACTIONS
        and model_name == model._meta.model_name
    ):
        return pgettext(
            'Admin permission label',
            '%(action)s %(model)s',
        ) % {
            'action': pgettext(
                'Admin permission action',
                DEFAULT_PERMISSION_ACTIONS[action],
            ),
            'model': str(model._meta.verbose_name),
        }
    return str(permission)


def configure_permission_choice_field(form_field):
    """Keep permission labels localizable without changing stored rows."""
    if form_field is None:
        return None
    form_field.queryset = form_field.queryset.select_related('content_type')
    form_field.label_from_instance = permission_choice_label
    return form_field

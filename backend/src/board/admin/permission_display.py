from django.contrib.auth.models import Permission
from django.db.models import Model
from django.utils.translation import pgettext


DEFAULT_PERMISSION_ACTIONS = {
    'add': 'Add',
    'change': 'Change',
    'delete': 'Delete',
    'view': 'View',
}

PRODUCT_PERMISSION_MODEL_LABELS = {
    'board.integrationsetting': 'Telegram integration settings',
    'board.loginsetting': 'Login and security settings',
    'board.sitesetting': 'Site settings',
    'board.staticpage': 'Static page',
    'board.utilitycleanupconfirmation': 'Utility cleanup confirmation',
}


def permission_model_label(model: type[Model]) -> str:
    """Return a localizable display label without changing model metadata."""
    source_label = PRODUCT_PERMISSION_MODEL_LABELS.get(
        model._meta.label_lower,
    )
    if source_label is None:
        return str(model._meta.verbose_name)
    return pgettext('Admin permission model', source_label)


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
            'model': permission_model_label(model),
        }
    return str(permission)


def configure_permission_choice_field(form_field):
    """Keep permission labels localizable without changing stored rows."""
    if form_field is None:
        return None
    form_field.queryset = form_field.queryset.select_related('content_type')
    form_field.label_from_instance = permission_choice_label
    return form_field

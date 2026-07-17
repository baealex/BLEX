def is_admin_changelist_request(request, model) -> bool:
    """Return whether a request resolves to the model's Admin list."""
    resolver_match = getattr(request, 'resolver_match', None)
    if resolver_match is None:
        return False
    opts = model._meta
    return resolver_match.url_name == (
        f'{opts.app_label}_{opts.model_name}_changelist'
    )


class ReadOnlyRecordAdminMixin:
    """Inspect externally owned or system-managed rows without editing them."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        if obj is not None:
            return False
        return super().has_change_permission(request, obj)


class ServiceOwnedRecordAdminMixin(ReadOnlyRecordAdminMixin):
    """Expose service-owned rows for inspection without raw CRUD paths."""

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop('delete_selected', None)
        return actions

    def has_delete_permission(self, request, obj=None):
        return False


class ConfirmedActionDeleteAdminMixin:
    """Disable Django deletes while retaining delete permission for actions."""

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop('delete_selected', None)
        return actions

    def has_delete_permission(self, request, obj=None):
        if obj is not None:
            return False
        return super().has_delete_permission(request, obj)

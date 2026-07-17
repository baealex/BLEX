class ReadOnlyRecordAdminMixin:
    """Inspect externally owned or system-managed rows without editing them."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        if obj is not None:
            return False
        return super().has_change_permission(request, obj)


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

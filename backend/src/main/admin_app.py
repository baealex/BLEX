from django.contrib.admin.apps import AdminConfig


class BlexAdminConfig(AdminConfig):
    default_site = 'main.admin_site.BlexAdminSite'

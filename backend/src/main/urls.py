"""main URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/2.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import os
from django.urls import include, path
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static

from board.views.static_pages import custom_404_view

urlpatterns = []

if settings.DEBUG:
    urlpatterns += static(settings.RESOURCE_URL, document_root=os.path.join(settings.BASE_DIR, 'resources'))
    urlpatterns += [
        path('404', custom_404_view),
    ]

from main.admin_path import get_admin_path

urlpatterns += [
    path(f'{get_admin_path()}/', admin.site.urls),
    path('', include('board.urls')),
]

handler404 = custom_404_view

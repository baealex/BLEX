"""Bearer-authenticated developer API routes."""

from django.urls import path

from board.views.api.developer.v1.api import api as developer_api_v1


urlpatterns = [
    path('api/developer/v1/', developer_api_v1.urls),
]

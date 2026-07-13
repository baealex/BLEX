"""Compatibility facade for BLEX URL declarations."""

from django.urls import include, path

from board.urlconfs import developer_api, internal_api, pages


urlpatterns = [
    path('', include(pages)),
    path('', include(internal_api)),
    path('', include(developer_api)),
]

"""Public page, discovery, feed, and sitemap routes."""

from django.contrib.auth import views as auth_views
from django.urls import path

from board.feeds import SitePostsFeed, UserPostsFeed
from board.sitemaps import sitemaps
from board.views import agent, main
from board.views.auth import login_view, signup_view
from board.views.author import (
    author_about,
    author_about_edit,
    author_featured_posts_partial,
    author_overview,
    author_posts,
    author_series,
)
from board.views.developer_api_docs import developer_api_docs, developer_api_quickstart
from board.views.initial_setup import initial_setup_view
from board.views.oauth_callback import oauth_callback
from board.views.post import post_detail, post_editor
from board.views.post_actions import like_post
from board.views.search import search_page
from board.views.series import series_detail
from board.views.settings import admin_settings, settings
from board.views.sitemap import sitemap_index_view, sitemap_section_view
from board.views.static_pages import static_page_view
from board.views.tag import tag_detail_view, tag_list_view


urlpatterns = [
    path('', main.index, name='index'),
    path('interests', main.interested_posts, name='interested_posts'),
    path('setup', initial_setup_view, name='initial_setup'),
    path('login', login_view, name='login'),
    path('sign', signup_view, name='signup'),
    path('login/callback/<str:provider>', oauth_callback, name='oauth_callback'),
    path('logout', auth_views.LogoutView.as_view(), name='logout'),
    path('llms.txt', agent.llms_txt, name='llms_txt'),

    # Static pages
    path('static/<path:slug>.md', agent.static_page_markdown, name='static_page_markdown'),
    path('static/<path:slug>', static_page_view, name='static_page'),

    # Settings - Unified Settings App with client-side routing
    path('settings/', settings, name='settings'),
    path('settings/<path:path>', settings, name='settings_path'),
    path('admin-settings/', admin_settings, name='admin_settings'),
    path('admin-settings/<path:path>', admin_settings, name='admin_settings_path'),

    # Developer API docs compatibility redirect
    path('docs/developer-api', developer_api_docs, name='developer_api_docs'),
    path('docs/developer-api/quickstart', developer_api_quickstart, name='developer_api_quickstart'),
    path('docs/developer-api/<slug:operation_id>', developer_api_docs, name='developer_api_docs_detail'),

    # Post actions
    path('like/<url>', like_post, name='like_post'),

    # Author
    path('@<username>/series', author_series, name='user_series'),
    path('@<username>/about', author_about, name='user_about'),
    path('@<username>/about/edit', author_about_edit, name='user_about_edit'),
    path(
        '@<username>/partials/featured-posts',
        author_featured_posts_partial,
        name='user_featured_posts_partial',
    ),
    path('@<username>/series/<series_url>.md', agent.series_markdown, name='series_markdown'),
    path('@<username>/series/<series_url>', series_detail, name='series_detail'),
    path('@<username>/posts', author_posts, name='user_posts'),
    path('@<username>/<post_url>.md', agent.post_markdown, name='post_markdown'),
    path('@<username>/<post_url>/edit', post_editor, name='post_edit'),
    path('@<username>/<post_url>', post_detail, name='post_detail'),
    path('@<username>', author_overview, name='user_profile'),

    # Posts write
    path('write', post_editor, name='post_write'),
    path('search', search_page, name='search'),

    # Tags
    path('tags', tag_list_view, name='tag_list'),
    path('tag/<str:name>', tag_detail_view, name='tag_detail'),

    # Sitemap Generator
    path('sitemap.xml', sitemap_index_view, {'sitemaps': sitemaps}, name='sitemap'),
    path(
        '<section>/sitemap.xml',
        sitemap_section_view,
        {'sitemaps': sitemaps},
        name='sitemap_section',
    ),

    # RSS and Etc
    path('rss', SitePostsFeed(), name='site_rss_feed'),
    path('rss/@<username>', UserPostsFeed(), name='user_rss_feed'),
    path('robots.txt', agent.robots_txt, name='robots_txt'),
]

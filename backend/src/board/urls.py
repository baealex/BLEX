from django.contrib.sitemaps.views import sitemap
from django.urls import path
from django.views.generic import TemplateView
from django.contrib.auth import views as auth_views
# from graphene_django.views import GraphQLView

from board.sitemaps import sitemaps, sitemap_section
from board.feeds import SitePostsFeed, UserPostsFeed
from board.views.api import v1 as api_v1
from board.views import main
from board.views.post_actions import like_post
from board.views.authors import authors_view
from board.views.author import author_posts, author_series, author_about, author_about_edit, author_overview
from board.views.post import post_detail, post_editor
from board.views.series import series_detail, series_create, series_edit
from board.views.auth import login_view, signup_view
from board.views.oauth_callback import oauth_callback
from board.views.tag import tag_list_view, tag_detail_view
from board.views.static_pages import static_page_view
from board.views.settings import (
    setting_notify, setting_profile, setting_account, setting_series,
    setting_posts,
    setting_integration, setting_forms, setting_temp_posts, setting_banners
)
from board.decorators import staff_member_required

def empty():
    pass


urlpatterns = [
    path('', main.index, name='index'),
    path('authors', authors_view, name='authors'),
    path('login', login_view, name='login'),
    path('sign', signup_view, name='signup'),
    path('login/callback/<str:provider>', oauth_callback, name='oauth_callback'),
    path('logout', auth_views.LogoutView.as_view(), name='logout'),

    # Static pages
    path('static/<slug:slug>', static_page_view, name='static_page'),

    # Settings Pages
    path('settings/notify', setting_notify, name='setting_notify'),
    path('settings/profile', setting_profile, name='setting_profile'),
    path('settings/account', setting_account, name='setting_account'),
    path('settings/series', setting_series, name='setting_series'),
    path('settings/posts', setting_posts, name='setting_posts'),
    path('settings/integration', setting_integration, name='setting_integration'),
    path('settings/forms', setting_forms, name='setting_forms'),
    path('settings/temp-posts', setting_temp_posts, name='setting_temp_posts'),
    path('settings/banners', setting_banners, name='setting_banners'),

    # Post actions
    path('like/<url>', like_post, name='like_post'),

    # Author
    path('@<username>/series', author_series, name='user_series'),
    path('@<username>/series/create', series_create, name='series_create'),
    path('@<username>/about', author_about, name='user_about'),
    path('@<username>/about/edit', author_about_edit, name='user_about_edit'),
    path('@<username>/series/<series_url>', series_detail, name='series_detail'),
    path('@<username>/series/<series_url>/edit', series_edit, name='series_edit'),
    path('@<username>/posts', author_posts, name='user_posts'),
    path('@<username>/<post_url>/edit', post_editor, name='post_edit'),
    path('@<username>/<post_url>', post_detail, name='post_detail'),
    path('@<username>', author_overview, name='user_profile'),

    # Posts write
    path('write', post_editor, name='post_write'),

    # Tags
    path('tags', tag_list_view, name='tag_list'),
    path('tag/<str:name>', tag_detail_view, name='tag_detail'),

    # Sitemap Generator
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='sitemap'),
    path('<section>/sitemap.xml', sitemap, {'sitemaps': sitemap_section}, name='sitemap_section'),

    # RSS and Etc
    path('rss', SitePostsFeed()),
    path('rss/@<username>', UserPostsFeed(), name='user_rss_feed'),
    path('robots.txt', TemplateView.as_view(template_name='robots.txt', content_type='text/plain')),
    # GraphQL
    # path('graphql', GraphQLView.as_view(graphiql=True)),

    # API V1
    path('v1/login', api_v1.login),
    path('v1/logout', api_v1.logout),
    path('v1/sign', api_v1.sign),
    path('v1/sign/<social>', api_v1.sign_social),
    path('v1/social-providers', api_v1.social_providers),
    path('v1/auth/security', api_v1.security),
    path('v1/auth/security/verify', api_v1.security_verify),
    path('v1/setting/<parameter>', api_v1.setting),
    path('v1/search', api_v1.search),
    path('v1/posts', api_v1.post_list),
    path('v1/posts/<url>/comments', api_v1.post_comment_list),
    path('v1/temp-posts', api_v1.temp_posts_list),
    path('v1/temp-posts/<token>', api_v1.temp_posts_detail),
    path('v1/comments', api_v1.comment_list),
    path('v1/comments/user', api_v1.user_comment),
    path('v1/comments/<int:id>', api_v1.comment_detail),
    path('v1/users/@<username>/heatmap', api_v1.get_author_heatmap),
    path('v1/users/@<username>', api_v1.users),
    path('v1/users/@<username>/posts/<url>', api_v1.user_posts),
    path('v1/users/@<username>/posts/<url>/related', api_v1.user_post_related),
    path('v1/users/@<username>/series', api_v1.user_series),
    path('v1/users/@<username>/series/<url>', api_v1.user_series),
    path('v1/users/@<username>/check-redirect', api_v1.check_redirect),
    path('v1/series', api_v1.series_create_update),
    path('v1/series/<int:series_id>', api_v1.series_detail),
    path('v1/series/valid-posts', api_v1.posts_can_add_series),
    path('v1/series/order', api_v1.series_order),
    path('v1/report/error', api_v1.error_report),
    path('v1/image', api_v1.image),
    path('v1/forms', api_v1.forms_list),
    path('v1/forms/<int:id>', api_v1.forms_detail),
    path('v1/telegram/<parameter>', api_v1.telegram),
    path('v1/banners', api_v1.banner),
    path('v1/banners/order', api_v1.banner_order),
    path('v1/banners/<int:banner_id>', api_v1.banner),
]

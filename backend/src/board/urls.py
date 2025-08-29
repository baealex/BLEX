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
from board.views.search import search_view
from board.views.authors import authors_view
from board.views.author import author_posts, author_series, author_about, author_about_edit
from board.views.post import post_detail, post_editor
from board.views.series import series_detail, series_create, series_edit
from board.views.auth import login_view, signup_view
from board.views.oauth_callback import oauth_callback
from board.views.tag import tag_list_view, tag_detail_view
from board.views.static_pages import about_view, privacy_view, terms_view
from board.views.settings import (
    setting_dashboard, setting_profile, setting_account, setting_notify, setting_series,
    setting_posts, setting_analytics,
    setting_integration, setting_invitation, setting_forms, setting_temp_posts
)
from board.decorators import staff_member_required

def empty():
    pass


urlpatterns = [
    path('', main.index, name='index'),
    path('search', search_view, name='search'),
    path('authors', authors_view, name='authors'),
    path('like/<str:url>', like_post, name='like_post'),
    path('login', login_view, name='login'),
    path('sign', signup_view, name='signup'),
    path('login/callback/<str:provider>', oauth_callback, name='oauth_callback'),
    path('logout', auth_views.LogoutView.as_view(), name='logout'),

    # Static pages
    path('about', about_view, name='about'),
    path('privacy', privacy_view, name='privacy'),
    path('terms', terms_view, name='terms'),

    # Settings Pages
    path('settings/dashboard', setting_dashboard, name='setting_dashboard'),
    path('settings/profile', setting_profile, name='setting_profile'),
    path('settings/account', setting_account, name='setting_account'),
    path('settings/notify', setting_notify, name='setting_notify'),
    path('settings/series', setting_series, name='setting_series'),
    path('settings/posts', setting_posts, name='setting_posts'),
    path('settings/analytics', setting_analytics, name='setting_analytics'),
    path('settings/integration', setting_integration, name='setting_integration'),
    path('settings/invitation', setting_invitation, name='setting_invitation'),
    path('settings/forms', setting_forms, name='setting_forms'),
    path('settings/temp-posts', setting_temp_posts, name='setting_temp_posts'),

    # Author
    path('@<username>/series', author_series, name='user_series'),
    path('@<username>/series/create', series_create, name='series_create'),
    path('@<username>/about', author_about, name='user_about'),
    path('@<username>/about/edit', author_about_edit, name='user_about_edit'),
    path('@<username>/<post_url>', post_detail, name='post_detail'),
    path('@<username>/series/<series_url>', series_detail, name='series_detail'),
    path('@<username>/series/<series_url>/edit', series_edit, name='series_edit'),
    path('@<username>/<post_url>/edit', post_editor, name='post_edit'),
    path('@<username>', author_posts, name='user_profile'),

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
    path('v1/auth/email-verify/<token>', api_v1.email_verify),
    path('v1/auth/security', api_v1.security),
    path('v1/auth/security/send', api_v1.security_send),
    path('v1/setting/<parameter>', api_v1.setting),
    path('v1/search', api_v1.search),
    path('v1/search/suggest', api_v1.search_suggest),
    path('v1/search/history', api_v1.search_history_list),
    path('v1/search/history/<int:item_id>', api_v1.search_history_detail),
    path('v1/tags', api_v1.tag_list),
    path('v1/tags/<name>', api_v1.tag_detail),
    path('v1/posts', api_v1.post_list),
    path('v1/posts/trending', api_v1.trending_post_list),
    path('v1/posts/newest', api_v1.newest_post_list),
    path('v1/posts/liked', api_v1.liked_post_list),
    path('v1/posts/feature', api_v1.feature_post_list),
    path('v1/posts/pinned', api_v1.pinned_post_list),
    path('v1/posts/pinnable', api_v1.pinnable_post_list),
    path('v1/posts/<url>/comments', api_v1.post_comment_list),
    path('v1/posts/<url>/analytics', api_v1.post_analytics),
    path('v1/temp-posts', api_v1.temp_posts_list),
    path('v1/temp-posts/<token>', api_v1.temp_posts_detail),
    path('v1/comments', api_v1.comment_list),
    path('v1/comments/user', api_v1.user_comment),
    path('v1/comments/<int:id>', api_v1.comment_detail),
    path('v1/users/@<username>', api_v1.users),
    path('v1/users/@<username>/posts', api_v1.user_posts),
    path('v1/users/@<username>/posts/<url>', api_v1.user_posts),
    path('v1/users/@<username>/series', api_v1.user_series),
    path('v1/users/@<username>/series/<url>', api_v1.user_series),
    path('v1/users/@<username>/check-redirect', api_v1.check_redirect),
    path('v1/series', api_v1.series_create_update),
    path('v1/series/<int:series_id>', api_v1.series_detail),
    path('v1/series/valid-posts', api_v1.posts_can_add_series),
    path('v1/series/order', api_v1.series_order),
    path('v1/upload/image', api_v1.image),
    path('v1/report/error', api_v1.error_report),
    path('v1/report/article/<url>', api_v1.article_report),
    path('v1/invitation/owners', api_v1.invitation_owners),
    path('v1/invitation/requests', api_v1.invitation_requests),
    path('v1/invitation/<int:invitation_id>', api_v1.invitation_respond),
    path('v1/image', api_v1.image),
    path('v1/forms', api_v1.forms_list),
    path('v1/forms/<int:id>', api_v1.forms_detail),
    path('v1/telegram/<parameter>', api_v1.telegram),
    path('v1/dashboard/stats', api_v1.dashboard_stats),
    path('v1/dashboard/activities', api_v1.dashboard_activities),
]

from django.contrib.sitemaps.views import sitemap
from django.urls import path
from django.views.generic import TemplateView

from board.sitemaps import sitemaps
from board.feeds import SitePostsFeed, UserPostsFeed
from board.views.api import v1 as api_v1

def empty():
    pass

urlpatterns = [
    # Sitemap Generator
    path('tags/<tag>', empty, name='post_list_in_tag'),
    path('@<username>', empty, name='user_profile'),
    path('@<username>/posts', empty, name='user_profile_posts'),
    path('@<username>/posts/<tag>', empty, name='user_profile_posts'),
    path('@<username>/<tab>', empty, name='user_profile_tab'),
    path('@<username>/<url>', empty, name='post_detail'),
    path('@<username>/series/<url>', empty, name='series_list'),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='sitemap'),

    # RSS and Etc
    path('rss', SitePostsFeed()),
    path('rss/@<username>', UserPostsFeed(), name="user_rss_feed"),
    path('robots.txt', TemplateView.as_view(template_name="robots.txt", content_type='text/plain')),

    # API V1
    path('v1/login', api_v1.login, name='login_api_v1'),
    path('v1/logout', api_v1.logout, name='logout_api_v1'),
    path('v1/sign', api_v1.sign, name='sign_api_v1'),
    path('v1/sign/<social>', api_v1.sign_social, name='sign_social_api_v1'),
    path('v1/auth/email-verify/<token>', api_v1.email_verify, name='email_verify_api_v1'),
    path('v1/auth/security', api_v1.security, name='security_api_v1'),
    path('v1/auth/security/send', api_v1.security_send, name='security_send_api_v1'),
    path('v1/setting/<item>', api_v1.setting, name='setting_api_v1'),
    path('v1/tags', api_v1.tags, name='tags_api_v1'),
    path('v1/tags/<tag>', api_v1.tags, name='tags_api_v1'),
    path('v1/posts/temp', api_v1.temp_posts, name='temp_posts_api_v1'),
    path('v1/posts', api_v1.posts, name='posts_api_v1'),
    path('v1/posts/feature', api_v1.feature_posts, name="feature_posts_api_v1"),
    path('v1/posts/feature/<tag>', api_v1.feature_posts, name="feature_posts_api_v1"),
    path('v1/posts/<url>/comments', api_v1.posts_comments, name='posts_api_v1'),
    path('v1/posts/<url>/analytics', api_v1.posts_analytics, name='posts_api_v1'),
    path('v1/comments', api_v1.comment, name='comment_api_v1'),
    path('v1/comments/<int:pk>', api_v1.comment, name='comment_api_v1'),
    path('v1/users/@<username>', api_v1.users, name='users_api_v1'),
    path('v1/users/@<username>/posts', api_v1.user_posts, name='post_api_v1'),
    path('v1/users/@<username>/posts/<url>', api_v1.user_posts, name='post_api_v1'),
    path('v1/users/@<username>/series', api_v1.user_series, name='series_api_v1'),
    path('v1/users/@<username>/series/<url>', api_v1.user_series, name='series_api_v1'),
    path('v1/image', api_v1.image, name='image_api_v1'),
    path('v1/forms', api_v1.forms, name='forms_api_v1'),
    path('v1/forms/<pk>', api_v1.forms, name='forms_api_v1'),
    path('v1/telegram/<parameter>', api_v1.telegram, name='telegram_api_v1'),
    # ------------------------------------------------------------ API V1 End
]
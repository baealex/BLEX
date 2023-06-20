from django.contrib.sitemaps.views import sitemap
from django.urls import path
from django.views.generic import TemplateView
# from graphene_django.views import GraphQLView

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
    path('rss/@<username>', UserPostsFeed(), name='user_rss_feed'),
    path('robots.txt', TemplateView.as_view(
        template_name='robots.txt', content_type='text/plain')),

    # GraphQL
    # path('graphql', GraphQLView.as_view(graphiql=True)),

    # API V1
    path('v1/login', api_v1.login),
    path('v1/logout', api_v1.logout),
    path('v1/sign', api_v1.sign),
    path('v1/sign/<social>', api_v1.sign_social),
    path('v1/auth/email-verify/<token>', api_v1.email_verify),
    path('v1/auth/security', api_v1.security),
    path('v1/auth/security/send', api_v1.security_send),
    path('v1/setting/<parameter>', api_v1.setting),
    path('v1/search', api_v1.search),
    path('v1/search/history', api_v1.search_history_list),
    path('v1/search/history/<int:item_id>', api_v1.search_history_detail),
    path('v1/tags', api_v1.tag_list),
    path('v1/tags/<tag>', api_v1.tag_detail),
    path('v1/posts', api_v1.post_list),
    path('v1/posts/popular', api_v1.popular_post_list),
    path('v1/posts/newest', api_v1.newest_post_list),
    path('v1/posts/liked', api_v1.liked_post_list),
    path('v1/posts/feature', api_v1.feature_post_list),
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
    path('v1/report/error', api_v1.error_report),
    path('v1/image', api_v1.image),
    path('v1/forms', api_v1.forms_list),
    path('v1/forms/<int:id>', api_v1.forms_detail),
    path('v1/openai/<parameter>', api_v1.openai),
    path('v1/telegram/<parameter>', api_v1.telegram),
    # ------------------------------------------------------------ API V1 End
]

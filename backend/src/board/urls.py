from django.contrib.auth import views as auth_views
from django.contrib.sitemaps.views import sitemap
from django.urls import path
from django.views.generic import TemplateView

from board.sitemaps import sitemaps
from board.feeds import SitePostsFeed, UserPostsFeed
# from board import views
from board.views.api import v1 as api_v1

# urlpatterns = [
#   """
#   # Account
#   path('login', views.login, name='login'),
#   path('login/callback/<social>', views.social_login, name='social_login'),
#   path('login/social/username/set', views.set_username, name='set_username'),
#   path('logout', auth_views.LogoutView.as_view(), name='logout'),
#   path('signup', views.signup, name='signup'),
#   path('signup/help/id', views.id_check, name='id_check'),
#   path('active/<token>', views.user_active, name='user_active'),
#   path('signout', views.signout, name='signout'),
#   path('opinion', views.opinion, name='opinion'),
#   path('setting', views.setting, name='setting'),
#   path('external', views.external, name='external'),
#   path('setting/<tab>', views.setting_tab, name='setting_tab'),
#   path('notify:<pk>', views.notify_redirect, name='notify_redirect'),
#   # ------------------------------------------------------------ Account End
#
#   # Profile
#   path('@<username>', views.user_profile_tab, name='user_profile'),
#   path('@<username>/posts/', views.user_profile_posts, name='user_profile_posts'),
#   path('@<username>/posts/<tag>', views.user_profile_posts, name='user_profile_posts'),
#   path('@<username>/<tab>/', views.user_profile_tab, name='user_profile_tab'),
#   path('@<username>/blog/<tag>', views.user_profile_tag_redirect, name='user_profile_tag_redirect'),
#   # ------------------------------------------------------------ Profile End
#
#   # Series
#   path('series/<int:spk>/update', views.series_update, name='series_update'),
#   path('@<username>/series/<url>', views.series_list, name='series_list'),
#   # ------------------------------------------------------------ Series End
#
#   # Others
#   path('search', views.search, name='search'),
#   path('backup', views.content_backup,name='content_backup'),
#   path('upload/image', views.image_upload, name='image_upload'),
#   # Not in views
#   path('rss', SitePostsFeed()),
#   path('rss/@<username>', UserPostsFeed(), name="user_rss_feed"),
#   path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='sitemap'),
#   path('robots.txt', TemplateView.as_view(template_name="robots.txt", content_type='text/plain')),
#   # ------------------------------------------------------------ Others End
#
#   # Article
#   path('@<username>/<url>', views.post_detail, name='post_detail'),
#   path('write', views.post_write, name='post_write'),
#   path('', views.post_sort_list, name='post_sort_list'),
#   path('<sort>', views.post_sort_list, name='post_sort_list'),
#   path('tag/<tag>', views.post_list_in_tag, name='post_list_in_tag'),
#   path('topic/<tag>', views.post_list_in_tag_redirect, name='post_list_in_tag_redirect'),
#   path('edit/<timestamp>', views.post_edit, name='post_edit'),
#   # ------------------------------------------------------------ Article End
#

urlpatterns = [
    # API V1
    path('v1/topics', api_v1.topics, name='topics_api_v1'),
    path('v1/posts/<sort>', api_v1.posts, name='posts_api_v1'),
    path('v1/post/<url>', api_v1.post, name='post_api_v1'),
    path('v1/posts/temp', api_v1.temp_posts, name='temp_posts_api_v1'),
    path('v1/comments', api_v1.comment, name='comment_api_v1'),
    path('v1/comments/<int:pk>', api_v1.comment, name='comment_api_v1'),
    path('v1/series/<int:pk>', api_v1.series, name='series_api_v1'),
    path('v1/users/<username>', api_v1.users, name='users_api_v1'),
    path('v1/telegram/<parameter>', api_v1.telegram, name='telegram_api_v1'),
    # ------------------------------------------------------------ API V1 End
]
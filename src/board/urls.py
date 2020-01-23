from django.contrib.auth import views as auth_views
from django.contrib.sitemaps.views import sitemap
from django.urls import path
from django.views.generic import TemplateView

from .sitemaps import PostSitemap, sitemaps
from .feeds import LatestPostFeed
from . import views

urlpatterns = [
    # Account
    path('login', auth_views.LoginView.as_view(), name='login'),
    path('logout', auth_views.LogoutView.as_view(), name='logout'),
    path('signup', views.signup, name='signup'),
    path('signup/help/id', views.id_check, name='id_check'),
    path('active/<token>', views.user_active, name='user_active'),
    path('signout', views.signout, name='signout'),
    path('setting', views.setting, name='setting'),
    path('setting/<tab>', views.setting_tab, name='setting_tab'),
    # ------------------------------------------------------------ Account End

    # Profile
    path('@<username>', views.user_profile, name='user_profile'),
    path('@<username>/profile/<tab>', views.user_profile_tab, name='user_profile_tab'),
    path('@<username>/topic/<tag>', views.user_profile_topic, name='user_profile_topic'),
    # ------------------------------------------------------------ Profile End

    # Series
    path('series/<int:spk>/update', views.series_update, name='series_update'),
    path('series/<int:spk>/remove', views.series_remove, name='series_remove'),
    path('@<username>/series/<url>', views.series_list, name='series_list'),
    # ------------------------------------------------------------ Series End

    # Comment
    path('comment/<int:cpk>/like', views.comment_like, name='comment_like'),
    # ------------------------------------------------------------ Comment End

    # Others
    path('search', views.search, name='search'),
    path('backup',views.content_backup,name='content_backup'),
    path('upload/image', views.image_upload, name='image_upload'),
    path('topic/<tag>', views.post_list_in_tag, name='post_list_in_tag'),
    # Not in views
    path('rss', LatestPostFeed()),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='sitemap'),
    path('robots.txt', TemplateView.as_view(template_name="robots.txt", content_type='text/plain')),
    # ------------------------------------------------------------ Others End

    # Article
    path('@<username>/<url>', views.post_detail, name='post_detail'),
    path('',views.post_list,name='post_list'), 
    path('write',views.post_write,name='post_write'),
    path('<sort>',views.post_sort_list,name='post_sort_list'),
    path('post/<int:pk>/edit', views.post_edit, name='post_edit'),
    # ------------------------------------------------------------ Article End

    # API V1
    path('api/v1/notify', views.notify_api_v1, name='notify_api_v1'),
    path('api/v1/topics', views.topics_api_v1, name='topics_api_v1'),
    path('api/v1/posts/<int:pk>', views.posts_api_v1, name='posts_api_v1'),
    path('api/v1/comments', views.comment_api_v1, name='comment_api_v1'),
    path('api/v1/comments/<int:pk>', views.comment_api_v1, name='comment_api_v1'),
    path('api/v1/users/<username>', views.users_api_v1, name='users_api_v1'),
    # ------------------------------------------------------------ API V1 End
]
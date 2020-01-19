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
    path('signup',views.signup, name='signup'),
    path('signup/help/id',views.id_check, name='id_check'),
    path('active/<token>', views.user_active, name='user_active'),
    path('signout',views.signout, name='signout'),
    path('setting', views.setting, name='setting'),
    path('setting/<tab>', views.setting_tab, name='setting_tab'),
    # ------------------------------------------------------------ Account End

    # Profile
    path('@<username>', views.user_profile, name='user_profile'),
    path('@<username>/follow', views.user_follow, name='user_follow'),
    path('@<username>/profile/<tab>', views.user_profile_tab, name='user_profile_tab'),
    path('@<username>/topic/<tag>', views.user_profile_topic, name='user_profile_topic'),
    # ------------------------------------------------------------ Profile End

    # Series
    path('series/<int:spk>/update', views.series_update, name='series_update'),
    path('series/<int:spk>/remove', views.series_remove, name='series_remove'),
    path('@<username>/series/<url>', views.series_list, name='series_list'),
    # ------------------------------------------------------------ Series End

    # Notify
    path('user/notify', views.user_notify, name='user_notify'),
    path('notify/tagging/<touser>/<fromuser>', views.notify_user_tagging, name='notify_user_tagging'),
    # ------------------------------------------------------------ Notify End

    # Comment
    path('post/<int:pk>/comment', views.comment_post, name='comment_post'),
    path('post/<int:pk>/commentor',views.get_commentor,name='get_commentor'),
    path('comment/<int:cpk>', views.comment_rest, name='comment_rest'),
    path('comment/<int:cpk>/like', views.comment_like, name='comment_like'),
    path('comment/<int:cpk>/update', views.comment_update, name='comment_update'),
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
    path('post/<int:pk>/tag', views.post_tag, name='post_tag'),
    path('post/<int:pk>/like', views.post_like, name='post_like'),
    path('post/<int:pk>/hide', views.post_hide, name='post_hide'),
    path('post/<int:pk>/edit', views.post_edit, name='post_edit'),
    path('post/<int:pk>/remove', views.post_remove, name='post_remove'), 
    # ------------------------------------------------------------ Article End

    # API V1
    path('api/v1/topics', views.topics_api_v1, name='topics_api_v1'),
    # ------------------------------------------------------------ API V1 End
]
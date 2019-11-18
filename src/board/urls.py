from django.urls import path
from . import views
from django.contrib.auth import views as auth_views
from django.contrib.sitemaps.views import sitemap
from .sitemaps import PostSitemap
from django.views.generic import TemplateView

sitemaps = {
    'posts':PostSitemap,
}

urlpatterns = [
    # Account
    path('login', auth_views.login, name='login'),
    path('logout', auth_views.logout, name='logout', kwargs={'next_page': '/'}),
    path('signup',views.signup,name='signup'),
    path('active/<token>', views.user_active,name='user_active'),
    path('signout',views.signout,name='signout'),
    path('setting',views.setting,name='setting'),
    # ------------------------------------------------------------ Account End

    # Profile
    path('@<username>', views.user_profile,name='user_profile'),
    # ------------------------------------------------------------ Profile End

    # Series
    path('series/<int:spk>/update', views.series_update, name='series_update'),
    path('series/<int:spk>/remove', views.series_remove, name='series_remove'),
    # path('@<username>/series/<name>', views.some, name='some'),
    # ------------------------------------------------------------ Series End

    # Notify
    path('notify', views.notify_read, name='notify_read'),
    path('notify/count', views.notify_count, name='notify_count'),
    path('notify/content', views.notify_content, name='notify_content'),
    path('notify/tagging/<touser>/<fromuser>', views.notify_user_tagging, name='notify_user_tagging'),
    # ------------------------------------------------------------ Notify End

    # Comment
    path('post/<int:pk>/comment', views.comment_post, name='comment_post'),
    path('post/<int:pk>/commentor',views.get_commentor,name='get_commentor'),
    path('comment/<int:cpk>/update', views.comment_update, name='comment_update'),
    path('comment/<int:cpk>/remove', views.comment_remove, name='comment_remove'),
    # ------------------------------------------------------------ Comment End

    # Others
    path('search', views.search, name='search'),
    path('backup',views.content_backup,name='content_backup'),
    path('topic/<tag>', views.post_list_in_tag, name='post_list_in_tag'),
    # Not in views
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='sitemap'),
    path('robots.txt', TemplateView.as_view(template_name="robots.txt", content_type='text/plain')),
    # ------------------------------------------------------------ Others End

    # Article
    path('@<username>/<url>', views.post_detail, name='post_detail'),
    path('',views.post_list,name='post_list'), 
    path('write',views.post_write,name='post_write'),
    path('<sort>',views.post_sort_list,name='post_sort_list'),
    path('post/<int:pk>/like', views.post_like, name='post_like'),
    path('post/<int:pk>/edit', views.post_edit, name='post_edit'),
    path('post/<int:pk>/remove', views.post_remove, name='post_remove'), 
    # ------------------------------------------------------------ Article End
]
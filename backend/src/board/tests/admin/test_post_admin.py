from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory, TestCase

from board.admin.post import PostAdmin
from board.models import Post


class PostAdminTestCase(TestCase):
    def test_url_is_not_readonly_field(self):
        admin_instance = PostAdmin(Post, AdminSite())
        request = RequestFactory().get('/admin/board/post/')

        readonly_fields = admin_instance.get_readonly_fields(request, obj=None)

        self.assertNotIn('url', readonly_fields)

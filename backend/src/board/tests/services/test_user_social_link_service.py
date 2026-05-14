from django.test import TestCase

from board.models import Config, Profile, User, UserLinkMeta
from board.services.user_social_link_service import UserSocialLinkService


class UserSocialLinkServiceTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='social-user', password='test')
        Config.objects.create(user=self.user)
        Profile.objects.create(user=self.user)

    def test_split_items_ignores_empty_segments(self):
        self.assertEqual(
            UserSocialLinkService.split_items('github,url,1&&site,url,2&'),
            ['github,url,1', 'site,url,2'],
        )

    def test_update_user_social_links_creates_updates_and_deletes_links(self):
        update_link = UserLinkMeta.objects.create(
            user=self.user,
            name='github',
            value='https://github.com/old',
            order=1,
        )
        delete_link = UserLinkMeta.objects.create(
            user=self.user,
            name='old',
            value='https://old.example.com',
            order=2,
        )
        put = type('QueryDict', (), {
            'get': lambda self, key, default='': {
                'update': f'{update_link.id},github,https://github.com/new,3',
                'create': 'homepage,https://example.com,4',
                'delete': str(delete_link.id),
            }.get(key, default)
        })()

        social_links = UserSocialLinkService.update_user_social_links(self.user, put)

        update_link.refresh_from_db()
        self.assertEqual(update_link.value, 'https://github.com/new')
        self.assertEqual(update_link.order, 3)
        self.assertFalse(UserLinkMeta.objects.filter(id=delete_link.id).exists())
        self.assertTrue(
            UserLinkMeta.objects.filter(
                user=self.user,
                name='homepage',
                value='https://example.com',
                order=4,
            ).exists()
        )
        self.assertEqual(
            [item['name'] for item in social_links],
            ['github', 'homepage'],
        )

    def test_delete_social_links_keeps_other_user_links(self):
        other_user = User.objects.create_user(username='other-social-user', password='test')
        Config.objects.create(user=other_user)
        Profile.objects.create(user=other_user)
        other_link = UserLinkMeta.objects.create(
            user=other_user,
            name='github',
            value='https://github.com/other',
            order=1,
        )

        UserSocialLinkService.delete_social_links(self.user, str(other_link.id))

        self.assertTrue(UserLinkMeta.objects.filter(id=other_link.id).exists())

import json
from unittest.mock import patch

from django.test import TestCase
from django.test.client import Client

from board.models import AuthorInvite, Config, Post, Profile, User
from board.services.author_invite_service import AuthorInviteError


class UserManagementAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff_user = User.objects.create_user(
            username='staffuser',
            password='test',
            email='staff@test.com',
            is_staff=True,
        )
        Profile.objects.create(user=cls.staff_user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.staff_user)

        cls.reader = User.objects.create_user(
            username='reader',
            password='test',
            email='reader@test.com',
        )
        Profile.objects.create(user=cls.reader, role=Profile.Role.READER)

        cls.editor = User.objects.create_user(
            username='editor',
            password='test',
            email='editor@test.com',
        )
        Profile.objects.create(user=cls.editor, role=Profile.Role.EDITOR)
        Post.objects.create(author=cls.editor, title='Editor post', url='editor-post')

        cls.superuser = User.objects.create_user(
            username='superuser',
            password='test',
            email='super@test.com',
            is_staff=True,
            is_superuser=True,
        )
        Profile.objects.create(user=cls.superuser, role=Profile.Role.EDITOR)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='staffuser', password='test')

    def test_list_users_requires_login(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')

        response = client.get('/v1/admin/users')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_list_users_requires_staff(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='reader', password='test')

        response = client.get('/v1/admin/users')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_staff_can_list_users(self):
        response = self.client.get('/v1/admin/users')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        users = {user['username']: user for user in content['body']['users']}
        self.assertEqual(content['body']['pagination']['page'], 1)
        self.assertEqual(content['body']['pagination']['total'], 4)
        self.assertEqual(content['body']['stats']['total'], 4)
        self.assertEqual(content['body']['stats']['admins'], 2)
        self.assertEqual(users['reader']['role'], Profile.Role.READER)
        self.assertTrue(users['reader']['canChangeRole'])
        self.assertEqual(users['editor']['postCount'], 1)
        self.assertFalse(users['staffuser']['canChangeRole'])
        self.assertFalse(users['superuser']['canChangeRole'])

    def test_list_users_does_not_create_missing_profile(self):
        legacy_user = User.objects.create_user(
            username='legacyuser',
            password='test',
            email='legacy@test.com',
        )

        response = self.client.get('/v1/admin/users?q=legacyuser')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['users'][0]['role'], Profile.Role.READER)
        self.assertFalse(Profile.objects.filter(user=legacy_user).exists())

    def test_staff_can_filter_users(self):
        response = self.client.get('/v1/admin/users?q=read')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual([user['username'] for user in content['body']['users']], ['reader'])
        self.assertEqual(content['body']['pagination']['total'], 1)

    def test_staff_can_filter_users_by_role(self):
        response = self.client.get('/v1/admin/users?role=reader')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual([user['username'] for user in content['body']['users']], ['reader'])
        self.assertEqual(content['body']['stats']['readers'], 1)
        self.assertEqual(content['body']['stats']['editors'], 0)

    def test_staff_can_order_users_by_post_count(self):
        Post.objects.create(author=self.editor, title='Second editor post', url='second-editor-post')

        response = self.client.get('/v1/admin/users?ordering=-post_count')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['users'][0]['username'], 'editor')
        self.assertEqual(content['body']['users'][0]['postCount'], 2)

    def test_staff_can_paginate_users(self):
        response = self.client.get('/v1/admin/users?page=2&page_size=2')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['pagination']['page'], 2)
        self.assertEqual(content['body']['pagination']['pageSize'], 2)
        self.assertEqual(content['body']['pagination']['total'], 4)
        self.assertEqual(content['body']['pagination']['totalPages'], 2)
        self.assertFalse(content['body']['pagination']['hasNext'])
        self.assertTrue(content['body']['pagination']['hasPrevious'])
        self.assertEqual(
            [user['username'] for user in content['body']['users']],
            ['staffuser', 'superuser'],
        )

    def test_user_pagination_clamps_out_of_range_page(self):
        response = self.client.get('/v1/admin/users?page=999&page_size=2')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['pagination']['page'], 2)

    def test_staff_can_create_author_invite(self):
        response = self.client.post(
            '/v1/admin/author-invites',
            json.dumps({}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        invite = AuthorInvite.objects.get(code=content['body']['invite']['code'])
        self.assertEqual(invite.created_by, self.staff_user)
        self.assertEqual(content['body']['invite']['signupUrl'], f'/sign?invite={invite.code}')

    def test_author_invite_requires_staff(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='reader', password='test')

        response = client.post(
            '/v1/admin/author-invites',
            json.dumps({}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_staff_can_delete_unused_author_invite(self):
        invite = AuthorInvite.objects.create(
            code='delete-code',
            created_by=self.staff_user,
        )

        response = self.client.delete(f'/v1/admin/author-invites/{invite.id}')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertFalse(AuthorInvite.objects.filter(id=invite.id).exists())

    def test_delete_author_invite_requires_staff(self):
        invite = AuthorInvite.objects.create(
            code='reader-delete-code',
            created_by=self.staff_user,
        )
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='reader', password='test')

        response = client.delete(f'/v1/admin/author-invites/{invite.id}')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertTrue(AuthorInvite.objects.filter(id=invite.id).exists())

    def test_staff_cannot_delete_claimed_author_invite(self):
        invite = AuthorInvite.objects.create(
            code='claimed-delete-code',
            created_by=self.staff_user,
            claimed_by=self.reader,
            is_active=False,
        )

        response = self.client.delete(f'/v1/admin/author-invites/{invite.id}')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertTrue(AuthorInvite.objects.filter(id=invite.id).exists())

    def test_signup_with_author_invite_grants_editor_role(self):
        invite = AuthorInvite.objects.create(
            code='invite-code',
            created_by=self.staff_user,
        )
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')

        response = client.post('/v1/sign', {
            'username': 'invited',
            'name': 'Invited User',
            'email': 'invited@test.com',
            'password': 'strong-password',
            'invite_code': invite.code,
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        invited = User.objects.get(username='invited')
        self.assertEqual(invited.profile.role, Profile.Role.EDITOR)
        invite.refresh_from_db()
        self.assertEqual(invite.claimed_by, invited)
        self.assertFalse(invite.is_active)

    def test_signup_with_author_invite_rolls_back_user_when_redeem_fails(self):
        invite = AuthorInvite.objects.create(
            code='rollback-code',
            created_by=self.staff_user,
        )
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')

        with patch('board.views.api.v1.auth.AuthorInviteService.redeem_invite') as redeem_invite:
            redeem_invite.side_effect = AuthorInviteError('초대 실패')
            response = client.post('/v1/sign', {
                'username': 'rollbackuser',
                'name': 'Rollback User',
                'email': 'rollback@test.com',
                'password': 'strong-password',
                'invite_code': invite.code,
            })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertFalse(User.objects.filter(username='rollbackuser').exists())

    def test_author_invite_is_single_use(self):
        invite = AuthorInvite.objects.create(
            code='used-code',
            created_by=self.staff_user,
            claimed_by=self.reader,
            is_active=False,
        )
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')

        response = client.post('/v1/sign', {
            'username': 'secondinvited',
            'name': 'Second Invited User',
            'email': 'second@test.com',
            'password': 'strong-password',
            'invite_code': invite.code,
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.assertFalse(User.objects.filter(username='secondinvited').exists())

    def test_staff_can_promote_reader_to_editor(self):
        response = self.client.patch(
            f'/v1/admin/users/{self.reader.id}/role',
            json.dumps({'role': Profile.Role.EDITOR}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['user']['role'], Profile.Role.EDITOR)
        self.reader.profile.refresh_from_db()
        self.assertEqual(self.reader.profile.role, Profile.Role.EDITOR)
        self.assertTrue(Config.objects.filter(user=self.reader).exists())

    def test_staff_can_demote_editor_to_reader(self):
        response = self.client.patch(
            f'/v1/admin/users/{self.editor.id}/role',
            json.dumps({'role': Profile.Role.READER}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.editor.profile.refresh_from_db()
        self.assertEqual(self.editor.profile.role, Profile.Role.READER)

    def test_staff_cannot_change_own_role(self):
        response = self.client.patch(
            f'/v1/admin/users/{self.staff_user.id}/role',
            json.dumps({'role': Profile.Role.READER}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_staff_cannot_change_admin_role(self):
        response = self.client.patch(
            f'/v1/admin/users/{self.superuser.id}/role',
            json.dumps({'role': Profile.Role.READER}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        self.superuser.profile.refresh_from_db()
        self.assertEqual(self.superuser.profile.role, Profile.Role.EDITOR)

    def test_rejects_unknown_role(self):
        response = self.client.patch(
            f'/v1/admin/users/{self.reader.id}/role',
            json.dumps({'role': 'ADMIN'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

import json
import datetime

from unittest.mock import patch

from django.test import TestCase

from board.models import User, Invitation


class InvitationTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        User.objects.create_user(
            username='invitation_owner',
            password='invitation_owner',
            email='invitation_owner@invitation_owner.com',
            first_name='Invitation Owner User',
        )
    
    def test_get_invitation_owner_list(self):
        response = self.client.get('/v1/invitation/owners')
from django.test import RequestFactory, TestCase

from board.services.auth_request_parser import AuthRequestParser


class AuthRequestParserTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_parse_login_request_reads_json_body(self):
        request = self.factory.post(
            '/v1/login',
            '{"username":"test","password":"secret"}',
            content_type='application/json',
        )

        data = AuthRequestParser.parse_login_request(request)

        self.assertEqual(data['username'], 'test')
        self.assertEqual(data['password'], 'secret')

    def test_parse_login_request_returns_empty_dict_for_invalid_json(self):
        request = self.factory.post(
            '/v1/login',
            '{"username":',
            content_type='application/json',
        )

        self.assertEqual(AuthRequestParser.parse_login_request(request), {})

    def test_parse_login_request_returns_empty_dict_for_empty_body(self):
        request = self.factory.post('/v1/login')

        self.assertEqual(AuthRequestParser.parse_login_request(request), {})

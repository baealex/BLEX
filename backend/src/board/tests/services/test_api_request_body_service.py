from django.test import RequestFactory, TestCase

from board.services.api_request_body_service import ApiRequestBodyService


class ApiRequestBodyServiceTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_parse_json_returns_empty_dict_for_empty_body(self):
        request = self.factory.post('/v1/example', data=b'', content_type='application/json')

        self.assertEqual(ApiRequestBodyService.parse_json(request), {})

    def test_parse_json_decodes_utf8_json_body(self):
        request = self.factory.post(
            '/v1/example',
            data='{"title": "테스트"}'.encode('utf-8'),
            content_type='application/json',
        )

        self.assertEqual(ApiRequestBodyService.parse_json(request), {'title': '테스트'})

    def test_parse_json_or_error_returns_validate_error_for_invalid_json(self):
        request = self.factory.post('/v1/example', data=b'{invalid', content_type='application/json')

        data, error = ApiRequestBodyService.parse_json_or_error(request)

        self.assertIsNone(data)
        self.assertIsNotNone(error)
        self.assertEqual(error.status_code, 200)


    def test_parse_json_or_error_allows_custom_error_code(self):
        from board.modules.response import ErrorCode

        request = self.factory.post('/v1/example', data=b'{invalid', content_type='application/json')

        data, error = ApiRequestBodyService.parse_json_or_error(
            request,
            error_code=ErrorCode.INVALID_PARAMETER,
            message='invalid payload',
        )

        self.assertIsNone(data)
        self.assertIsNotNone(error)
        self.assertContains(error, 'error:IP')

    def test_parse_json_or_querydict_falls_back_to_form_body(self):
        request = self.factory.post(
            '/v1/example',
            data='title=Form+Title&post_ids=1%2C2',
            content_type='application/x-www-form-urlencoded',
        )

        data = ApiRequestBodyService.parse_json_or_querydict(request)

        self.assertEqual(data.get('title'), 'Form Title')
        self.assertEqual(data.get('post_ids'), '1,2')

    def test_parse_json_or_default_returns_default_for_invalid_json(self):
        request = self.factory.put('/v1/example/1', data=b'{invalid', content_type='application/json')

        self.assertEqual(ApiRequestBodyService.parse_json_or_default(request), {})

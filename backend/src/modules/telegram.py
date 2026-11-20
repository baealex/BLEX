import requests
import json

# (connect, read) seconds. Admin requests wait on these calls, so they must stay well under the worker timeout.
REQUEST_TIMEOUT_SECONDS = (3, 5)


class TelegramBot:
    def __init__(self, token):
        self.token = token
        self.url = 'https://api.telegram.org/bot' + self.token

    def send_message(self, chat_id, text):
        req_url = self.url + '/sendMessage'
        req_data = {
            'chat_id': chat_id,
            'text': text,
        }
        return json.loads(requests.get(req_url, req_data, timeout=REQUEST_TIMEOUT_SECONDS).text)

    def send_messages(self, chat_id, text_list):
        req_url = self.url + '/sendMessage'
        result = []
        for text in text_list:
            req_data = {
                'chat_id': chat_id,
                'text': text,
            }
            result.append(requests.get(req_url, req_data, timeout=REQUEST_TIMEOUT_SECONDS))
        return result

    def get_me(self):
        req_url = self.url + '/getMe'
        return requests.get(req_url, timeout=REQUEST_TIMEOUT_SECONDS).json()

    def get_updateds(self):
        req_url = self.url + '/getUpdates'
        return json.loads(requests.get(req_url, timeout=REQUEST_TIMEOUT_SECONDS).text)

    def set_webhook(self, url, secret_token=None, allowed_updates=None):
        req_url = self.url + '/setWebhook'
        req_data = {
            'url': url,
        }
        if secret_token:
            req_data['secret_token'] = secret_token
        if allowed_updates is not None:
            req_data['allowed_updates'] = allowed_updates
        return requests.post(req_url, json=req_data, timeout=REQUEST_TIMEOUT_SECONDS).json()

    def get_webhook_info(self):
        req_url = self.url + '/getWebhookInfo'
        return json.loads(requests.get(req_url, timeout=REQUEST_TIMEOUT_SECONDS).text)

    def delete_webhook(self):
        req_url = self.url + '/deleteWebhook'
        return json.loads(requests.get(req_url, timeout=REQUEST_TIMEOUT_SECONDS).text)

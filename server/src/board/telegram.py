import requests
import json
import threading

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
        return json.loads(requests.get(req_url, req_data).text)
    
    def send_messages(self, chat_id, text_list):
        req_url = self.url + '/sendMessage'
        result = []
        for text in text_list:
            req_data = {
                'chat_id': chat_id,
                'text': text,
            }
            result.append(requests.get(req_url, req_data))
        return result

    def send_message_async(self, chat_id, text):
        _thread = threading.Thread(target=self.send_message, args=(chat_id, text))
        _thread.start()
    
    def send_messages_async(self, chat_id, text_list):
        _thread = threading.Thread(target=self.send_messages, args=(chat_id, text_list))
        _thread.start()
    
    def get_updateds(self):
        req_url = self.url + '/getUpdates'
        return json.loads(requests.get(req_url).text)
    
    def set_webhook(self, url):
        req_url = self.url + '/setWebhook'
        req_data = {
            'url': url,
        }
        return json.loads(requests.get(req_url, req_data).text)
    
    def get_webhook_info(self):
        req_url = self.url + '/getWebhookInfo'
        return json.loads(requests.get(req_url).text)
    
    def delete_webhook(self):
        req_url = self.url + '/deleteWebhook'
        return json.loads(requests.get(req_url).text)
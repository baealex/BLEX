import requests

class Discord:
    def send_webhook(url, content):
        req_data = { 'content': content }
        requests.post(url, req_data)
    
import requests


class Assistant:
    def __init__(self, token):
        self.token = token
        self.url = 'https://api.openai.com/v1/chat/completions'

    def help(self, message: str):
        url = "https://api.openai.com/v1/chat/completions"

        data = {
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": message}],
            "temperature": 0.7
        }

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

        response = requests.post(url, json=data, headers=headers)

        return response.json()['choices'][0]['message']['content']

import re

import requests


class ParseData:
    def __init__(self, item):
        self.text = item['text']
        self.token = item['token']
    
    def to_dict(self):
        return {
            'text': self.text,
            'token': self.token,
        }

    @staticmethod
    def from_dict(item):
        return ParseData(item)


def parse_to_html(api_url: str, data: ParseData):
    response = requests.post(f'{api_url}/api/blexer', data=data.to_dict())
    return response.json()['text']


def get_images(markdown: str):
    return re.findall(r'!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)', markdown)

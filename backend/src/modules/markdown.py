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

    def from_dict(item):
        return ParseData(item)

def parse_to_html(siteUrl: str, data: ParseData):
    response = requests.post(f'{siteUrl}/api/blexer', data=data.to_dict())
    return response.json()['text']

def get_images(markdown: str):
    return re.findall(r'!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)', markdown)

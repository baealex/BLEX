import re

import requests

def parse_to_html(siteUrl, data: dict):
    response = requests.post(f'{siteUrl}/api/blexer', data={
        'text': data['text'],
        'token': data['token'],
    })
    return response.json()['text']

def get_images(markdown: str):
    return re.findall(r'!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)', markdown)

if __name__ == '__main__':
    print(parse_to_html('### 테스트 마크다운'))
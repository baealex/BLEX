import html
import re
import requests
import urllib
import traceback

headers = {
    'user-agent': 'blexmebot/1.0 (+http://blex.me/)',
}

def page_parser(url):
    data = {
        'title': '',
    }
    try:
        response = requests.get(url, headers=headers)
        title = re.search(r'<title.*?>(.+?)</title>', response.text)
        if title:
            title = title.group(1)
            title = html.unescape(title)
            title = urllib.parse.unquote(title)
            if not 'http://' in title and not 'https://' in title:
                data['title'] = title
    except:
        traceback.print_exc()
    if not data['title']:
        data['title'] = url.split('//')[1].split('/')[0]
    return data

if __name__ == '__main__':
    print(page_parser('http://localhost:8000'))
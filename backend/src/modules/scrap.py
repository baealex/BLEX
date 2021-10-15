import html
import io
import re
import urllib
import traceback

import requests

from typing import Union
from urllib.parse import urlparse

headers = {
    'user-agent': 'blexmebot/1.0 (+http://blex.me/)',
}

def page_parser(url: str):
    url_parse = urlparse(url)

    protocol = url_parse.scheme
    host     = url_parse.netloc
    origin   = f'{url_parse.scheme}://{url_parse.netloc}'

    data = {
        'title': '',
        'image': '',
        'description': '',
    }

    if not protocol == 'http' and not protocol == 'https':
        data['title'] = host
        return data

    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        og_title = re.search(r'<meta(?=\s|>)(?=(?:[^>=]|=\'[^\']*\'|=\"[^"]*\"|=[^\'\"][^\s>]*)*?\sproperty=(?:\'og:title|\"og:title\"|og:title))(?=(?:[^>=]|=\'[^\']*\'|=\"[^\"]*\"|=[^\'\"][^\s>]*)*?\scontent=(\'[^\']*\'|\"[^\"]*\"|[^\'\"][^\s>]*))(?:[^\'\">=]*|=\'[^\']*\'|="[^\"]*\"|=[^\'\"][^\s>]*)*>', response.text)
        og_image = re.search(r'<meta(?=\s|>)(?=(?:[^>=]|=\'[^\']*\'|=\"[^"]*\"|=[^\'\"][^\s>]*)*?\sproperty=(?:\'og:image|\"og:image\"|og:image))(?=(?:[^>=]|=\'[^\']*\'|=\"[^\"]*\"|=[^\'\"][^\s>]*)*?\scontent=(\'[^\']*\'|\"[^\"]*\"|[^\'\"][^\s>]*))(?:[^\'\">=]*|=\'[^\']*\'|="[^\"]*\"|=[^\'\"][^\s>]*)*>', response.text)
        og_description = re.search(r'<meta(?=\s|>)(?=(?:[^>=]|=\'[^\']*\'|=\"[^"]*\"|=[^\'\"][^\s>]*)*?\sproperty=(?:\'og:description|\"og:description\"|og:description))(?=(?:[^>=]|=\'[^\']*\'|=\"[^\"]*\"|=[^\'\"][^\s>]*)*?\scontent=(\'[^\']*\'|\"[^\"]*\"|[^\'\"][^\s>]*))(?:[^\'\">=]*|=\'[^\']*\'|="[^\"]*\"|=[^\'\"][^\s>]*)*>', response.text)
        
        if og_title:
            data['title'] = og_title[1].replace('\'', '').replace('\"', '')
        
        if og_image:
            data['image'] = og_image[1].replace('\'', '').replace('\"', '')
            if not '//' in data['image']:
                data['image'] = origin + '/' + data['image']
        
        if og_description:
            data['description'] = og_description[1].replace('\'', '').replace('\"', '')[:200] + ' '
        data['description'] += '(' + str(round(len(response.text) / 1024)) + 'kb)'

        if not data['title']:
            title = re.search(r'<title.*?>(.+?)</title>', response.text)
            if title:
                title = title.group(1)
                if not f'{protocol}://' in title:
                    data['title'] = title
        
        if not data['title']:
            data['title'] = host

        for name in ['title', 'description']:
            if data[name]:
                data[name] = html.unescape(data[name])
                data[name] = urllib.parse.unquote(data[name])
    except:
        traceback.print_exc()
    
    return data

def download_image(
    src: str,
    path='.',
    stream=False,
    referer='',
    filename='test',
) -> Union[None, str]:
    try:
        url_parse = urlparse(src)

        if not referer:
            referer = f'{url_parse.scheme}://{url_parse.netloc}/'

        headers = {
            'Referer': referer
        }

        res = requests.get(src, headers=headers, stream=stream)

        if not res.status_code == 200:
            return None
        
        content_type = res.headers['content-type']
        if not 'image' in content_type:
            return None
        
        if stream:
            binary_image = res.content
            temp_image = io.BytesIO()
            temp_image.write(binary_image)
            temp_image.seek(0)
            return temp_image
        
        ext = content_type.split('/')[-1]
        path = f'{path}/{filename}.{ext}'
        with open(path, 'wb') as f:
            for chunk in res.iter_content():
                f.write(chunk)
        return path
    except:
        traceback.print_exc()
    
    return None

if __name__ == '__main__':
    x = page_parser('https://blex.me/popular')
    # print(x)
    # print(download_image(x['image']))
    print(download_image(x['image'], stream=True))
import html
import io
import urllib.parse

import requests

from typing import Optional, Union
from urllib.parse import urlparse
from bs4 import BeautifulSoup

HEADERS = {
    'user-agent': 'blexmebot-MetaTagCollector/1.0 (+https://blex.me/)',
}


class OpenGraphParser:
    """Parses Open Graph meta tags from HTML content."""

    def __init__(self, soup: BeautifulSoup, origin: str):
        self.soup = soup
        self.origin = origin

    def get_meta_content(self, property_name: str) -> str:
        meta = self.soup.find('meta', property=property_name)
        if meta and meta.get('content'):
            return meta['content']
        return ''

    def get_title(self) -> str:
        title = self.get_meta_content('og:title')
        if title:
            return title

        title_tag = self.soup.find('title')
        if title_tag and title_tag.string:
            return title_tag.string.strip()

        return ''

    def get_image(self) -> str:
        image = self.get_meta_content('og:image')
        if image and '//' not in image:
            image = self.origin + '/' + image.lstrip('/')
        return image

    def get_description(self) -> str:
        return self.get_meta_content('og:description')[:200]


def page_parser(url: str) -> dict:
    """
    Parse a web page and extract Open Graph metadata.

    Args:
        url: The URL to parse

    Returns:
        Dictionary containing title, image, and description
    """
    url_parse = urlparse(url)
    protocol = url_parse.scheme
    host = url_parse.netloc
    origin = f'{protocol}://{host}'

    data = {
        'title': '',
        'image': '',
        'description': '',
    }

    if protocol not in ('http', 'https'):
        data['title'] = host
        return data

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        parser = OpenGraphParser(soup, origin)

        data['title'] = parser.get_title() or host
        data['image'] = parser.get_image()
        data['description'] = parser.get_description()

        if data['description']:
            data['description'] += ' '
        data['description'] += f'({round(len(response.text) / 1024)}kb)'

        for name in ['title', 'description']:
            if data[name]:
                data[name] = html.unescape(data[name])
                data[name] = urllib.parse.unquote(data[name])

    except requests.RequestException:
        pass

    return data


def download_image(
    src: str,
    path: str = '.',
    stream: bool = False,
    referer: str = '',
    filename: str = 'test',
) -> Union[None, str, io.BytesIO]:
    """
    Download an image from a URL.

    Args:
        src: Image source URL
        path: Directory path to save the image
        stream: If True, return BytesIO instead of saving to file
        referer: Referer header value
        filename: Filename without extension

    Returns:
        File path, BytesIO object, or None on failure
    """
    try:
        url_parse = urlparse(src)

        if not referer:
            referer = f'{url_parse.scheme}://{url_parse.netloc}/'

        headers = {'Referer': referer}
        res = requests.get(src, headers=headers, stream=stream, timeout=10)

        if res.status_code != 200:
            return None

        content_type = res.headers.get('content-type', '')
        if 'image' not in content_type:
            return None

        if stream:
            temp_image = io.BytesIO()
            temp_image.write(res.content)
            temp_image.seek(0)
            return temp_image

        ext = content_type.split('/')[-1]
        file_path = f'{path}/{filename}.{ext}'
        with open(file_path, 'wb') as f:
            for chunk in res.iter_content():
                f.write(chunk)
        return file_path

    except requests.RequestException:
        return None


if __name__ == '__main__':
    x = page_parser('https://blex.me/popular')
    print(download_image(x['image'], stream=True))

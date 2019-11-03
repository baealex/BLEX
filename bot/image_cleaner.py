import requests
import os
import platform
from bs4 import BeautifulSoup

SITE_NAME = 'https://blex.kr'

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERIFY_SLASH = ''
if(platform.system() == 'Windows'):
    VERIFY_SLASH = '\\'
else:
    VERIFY_SLASH = '/'
TARGET_DIR = BASE_DIR + VERIFY_SLASH + 'src' + VERIFY_SLASH + 'static' + VERIFY_SLASH + 'image'

if __name__ == '__main__':
    req = requests.get(SITE_NAME + '/sitemap.xml')
    html = req.text
    soup = BeautifulSoup(html, 'html.parser')
    post_urls = soup.select('url > loc')

    image_names = []
    for url in post_urls:
        # print(url.text)
        req = requests.get(url.text)
        html = req.text
        soup = BeautifulSoup(html, 'html.parser')
        images = soup.select('img')
        
        for image in images:
            # print(image.get('src'))
            image_names.append(image.get('src').split('/')[-1])
    image_names = list(set(image_names))

    for (path, dir, files) in os.walk(TARGET_DIR):
        for filename in files:
            if not filename in image_names:
                print(path + VERIFY_SLASH + filename)
                os.remove(path + VERIFY_SLASH + filename)
    print('All Done.')
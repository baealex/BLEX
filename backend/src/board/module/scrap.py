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
        'image': '',
        'description': '',
    }

    protocol = url.split('://')[0]
    host = url.split('://')[1].split('/')[0]
    origin = f'{protocol}://{host}'

    try:
        response = requests.get(url, headers=headers)
        
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

if __name__ == '__main__':
    print(page_parser('http://localhost:20001/asd'))
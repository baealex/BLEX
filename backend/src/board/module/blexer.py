import re

# TODO : 구분선 테이블 리스트 깊어지는 거

class Blexer:
    def __init__(self):
        self.is_safe_mode = True
        self.table_array = list()
        self.ul_array = list()
        self.ol_array = list()
        self.pre_array = list()
    
    def set_safe_mode(self, mode: bool):
        self.is_safe_mode = mode

    def to_html(self, text):
        html = str()
        for line in text.split('\n'):
            html += self.lineparser(line)
        html = self.decorator(html)
        return html
    
    def lineparser(self, line):
        result = str()
        block_name = str()
        
        if re.match(r'`{3}([a-zA-Z]*?)', line.strip()):
            block_name = 'Pre'
            if len(self.pre_array) > 0:
                element = {
                    'name': 'pre',
                    'text': '\n'.join(self.pre_array[1:])
                }
                if self.pre_array[0]:
                    element['class'] = 'language-' + self.pre_array[0]
                result += self.create_element(element)
                self.pre_array = list()
                return result
            else:
                self.pre_array.append(re.sub(r'`{3}([a-zA-Z]*?)', r'\1', line.strip()))
                return ''
        
        if len(self.pre_array) > 0:
            block_name = 'Pre'
            line = re.sub(r'\<', '&lt;', line)
            line = re.sub(r'\>', '&gt;', line)
            self.pre_array.append(self.clear_indent(line))
            return ''
        
        line = line.strip()
        if line == '':
            return ''
        
        if self.is_safe_mode:
            line = re.sub(r'\<', '&lt;', line)
            line = re.sub(r'\>', '&gt;', line)
            line = re.sub(r'&lt;br\/?&gt;', '<br/>', line)
            line = re.sub(r'&lt;center&gt;', '<div style="text-align: center;">', line)
            line = re.sub(r'&lt;\/center&gt;', '</div>', line)

        if re.match(r'\#*\s(.*)', line):
            block_name = 'Header'
            result = self.make_header(line)
        elif re.match(r'\@([a-z]*)\[(.*)\]', line):
            block_name = 'Media'
            result = self.make_media(line)
        elif re.match(r'[\-\*\_]{3}', line):
            block_name = 'Head-Line'
            result = self.make_headline(line)
        elif re.match(r'[\-\*\+]*\s(.*)', line):
            block_name = 'Normal-List'
            self.ul_array.append(self.make_list(line))
        elif re.match(r'[0-9]*.\s(.*)', line):
            block_name = 'Number-List'
            self.ol_array.append(self.make_list(line))
        else:
            block_name = 'Paragraph'
            result = self.make_paragraph(line)
        
        if not block_name == 'Normal-List' and len(self.ul_array) > 0:
            result = self.create_element({
                'name': 'ul',
                'text': ''.join(self.ul_array)
            }) + result
            self.ul_array = list()
        
        if not block_name == 'Number-List' and len(self.ol_array) > 0:
            result = self.create_element({
                'name': 'ul',
                'text': ''.join(self.ul_array)
            }) + result
            self.ol_array = list()

        return self.decorator(result)

    def decorator(self, text):
        result = text
        result = self.make_image(result)
        result = self.make_anchor(result)
        result = self.make_bold(result)
        result = self.make_italic(result)
        result = self.make_code(result)
        return result       

    def clear_indent(self, text):
        text = re.sub(r'[\t]', ' ' * 4, text)
        return text
    
    def slugify(self, text):
        return re.sub(r' ', '-', re.sub(r'[\!\@\#\$\%\^\&\*\(\)\+\=]', '', text))
    
    def make_paragraph(self, text):
        return self.create_element({
            'name': 'p',
            'text': text
        })
    
    def make_header(self, text):
        regex = re.compile(r'(\#*)\s(.*)')
        if regex.match(text):
            header = regex.sub(r'\1', text)[:6]
            id_text = regex.sub(r'\2', text)
            return regex.sub(self.create_element({
                'name': 'h' + str(len(header)),
                'id': self.slugify(id_text),
                'text': r'\2',
            }), text)
        return text
    
    def make_media(self, text):
        regex = re.compile(r'\@([a-z]*)\[(.*)\]')
        if regex.match(text):
            media = regex.sub(r'\1', text)
            if media == 'youtube':
                return regex.sub(self.make_paragraph(
                    '<iframe width="100%" height="350" '
                    'src="https://www.youtube.com/embed/' + r'\2' + '" frameborder="0"'
                    'allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" '
                    'allowfullscreen></iframe>'
                ), text)
            elif media == 'gif':
                return regex.sub(self.make_paragraph(
                    '<video class="lazy" '
                    'autoplay muted loop playsinline '
                    'poster="' + r'\2' + '.preview.jpg">'
                    '<source data-src="' + r'\2' + '" type="video/mp4"/>'
                    '</video>'
                ), text)
        return text
    
    def make_headline(self, text):
        regex = re.compile(r'[\-\*\_]{3}')
        if regex.match(text):
            return regex.sub(self.create_element({
                'name': 'hr',
            }), text)
        return text

    def make_list(self, text):
        regex = re.compile(r'[\-\*\+]\s(.*)')
        if regex.match(text):
            return regex.sub(self.create_element({
                'name': 'li',
                'text': r'\1',
            }), text)
        return text
    
    def make_code(self, text):
        regex = re.compile(r'\`([^\`]*)\`')
        if regex.search(text):
            return regex.sub(self.create_element({
                'name': 'code',
                'text': r'\1'
            }), text)
        return text
    
    def make_bold(self, text):
        regex = re.compile(r'\*\*([^\*]*)\*\*')
        if regex.search(text):
            return regex.sub(self.create_element({
                'name': 'b',
                'text': r'\1'
            }), text)
        return text

    def make_strike(self, text):
        regex = re.compile(r'\~([^\~]*)\~')
        if regex.search(text):
            return regex.sub(self.create_element({
                'name': 'del',
                'text': r'\1'
            }), text)
        return text
        
    def make_italic(self, text):
        regex = re.compile(r'\*([^\*]*)\*')
        if regex.search(text):
            return regex.sub(self.create_element({
                'name': 'i',
                'text': r'\1'
            }), text)
        return text
    
    def make_anchor(self, text):
        regex = re.compile(r'\[([^\!\[\]\(\)]*)\]\(([^\!\[\]\(\)]*)\)')
        if regex.search(text):
            return regex.sub(self.create_element({
                'name': 'a',
                'text': r'\1',
                'href': r'\2',
            }), text)
        return text
    
    def make_image(self, text):
        regex = re.compile(r'\!\[([^\!\[\]\(\)]*)\]\(([^\!\[\]\(\)]*)\s\"([^\"]*)\"\)')
        if regex.search(text):
            return regex.sub(self.create_element({
                'name': 'img',
                'alt': r'\1',
                'src': r'\2' + '.preview.jpg',
                'title': r'\3',
                'class': 'lazy',
                'data': [{
                    'name': 'src',
                    'value': r'\2',
                }]
            }), text)
        regex = re.compile(r'\!\[([^\!\[\]\(\)]*)\]\(([^\!\[\]\(\)]*)\)')
        if regex.search(text):
            return regex.sub(self.create_element({
                'name': 'img',
                'alt': r'\1',
                'src': r'\2' + '.preview.jpg',
                'class': 'lazy',
                'data': [{
                    'name': 'src',
                    'value': r'\2',
                }]
            }), text)
        return text

    def create_element(self, item):
        element = str()
        element += '<' + item['name']
        options = ['id', 'src', 'alt', 'href', 'title', 'class', 'style']
        for option in options:
            if option in item and item[option]:
                element += ' ' + option + '="' + item[option] + '"'
        if 'data' in item:
            for data in item['data']:
                if data['name'] and data['value']:
                    element += ' data-' + data['name'] + '="' + data['value'] + '"'
        if 'text' in item:
            element += '>'
            element += item['text']
            element += '</' + item['name'] + '>'
        else:
            element += '/>'
        return element

if __name__ == '__main__':
    blexer = Blexer()
    print(blexer.to_html('![대체 이미지 텍스트](https://github.com/xx.jpg "이미지 타이틀")'))
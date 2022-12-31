import os
import sys
import django

from PIL import Image, ImageFilter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CONTENT_IMAGE_DIR = BASE_DIR + '/static/images/content'
TITLE_IMAGE_DIR   = BASE_DIR + '/static/images/title'

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

if __name__ == '__main__':
    for (path, dir, files) in os.walk(CONTENT_IMAGE_DIR):
        for filename in files:
            if not 'preview.jpg' in filename and ('.jpeg' in filename or '.jpg' in filename or '.png' in filename):
                if not os.path.isfile(path + '/' + filename + '.preview.jpg'):
                    image_path = path + '/' + filename
                    preview_path = path + '/' + filename + '.preview.jpg'

                    convert_image = Image.open(image_path).convert('RGB')
                    preview_image = convert_image.filter(ImageFilter.GaussianBlur(50))
                    preview_image.save(preview_path, quality=50)
                    print(preview_path)
    
    for (path, dir, files) in os.walk(TITLE_IMAGE_DIR):
        for filename in files:
            if not 'preview.jpg' in filename and not 'minify' in filename:
                if not os.path.isfile(path + '/' + filename + '.preview.jpg'):
                    image_path = path + '/' + filename
                    preview_path = path + '/' + filename + '.preview.jpg'

                    convert_image = Image.open(image_path).convert('RGB')
                    preview_image = convert_image.filter(ImageFilter.GaussianBlur(50))
                    preview_image.save(preview_path, quality=50)
                    print(preview_path)
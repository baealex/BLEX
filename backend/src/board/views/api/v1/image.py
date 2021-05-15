import os
import datetime

from django.conf import settings
from django.http import Http404
from PIL import Image, ImageFilter

from board.models import ImageCache, randstr
from board.module.response import StatusDone, StatusError
from board.views import function as fn

def image(request):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404
        
        if request.FILES['image']:
            allowed_ext = ['jpg', 'jpeg', 'png', 'gif']
            
            image = request.FILES['image']
            image_key = fn.get_hash_key(image.read())

            try:
                image_cache = ImageCache.objects.get(key=image_key)
                return StatusDone({
                    'url': settings.MEDIA_URL + image_cache.path,
                })
            except:
                image_cache = ImageCache(key=image_key)
                ext = str(image).split('.')[-1].lower()

                if not ext in allowed_ext:
                    return StatusError('RJ', '허용된 확장자가 아닙니다.')
                    
                dt = datetime.datetime.now()
                upload_path = fn.make_path(
                    'static/images/content',
                    [
                        str(dt.year),
                        str(dt.month),
                        str(dt.day)
                    ]
                )

                file_name = str(dt.hour) + '_' + randstr(20)
                with open(upload_path + '/' + file_name + '.' + ext, 'wb+') as destination:
                    for chunk in image.chunks():
                        destination.write(chunk)
                
                if ext == 'gif':
                    try:
                        image_path = upload_path + '/' + file_name
                        convert_image = Image.open(image_path + '.' + ext).convert('RGB')
                        preview_image = convert_image.filter(ImageFilter.GaussianBlur(50))
                        preview_image.save(image_path + '.mp4.preview.jpg', quality=50)

                        os.system('ffmpeg -i '+ upload_path + '/' + file_name + '.gif' + ' -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart '+ upload_path + '/' + file_name +'.mp4')
                        os.system('rm ' + upload_path + '/' + file_name + '.gif')
                        ext = 'mp4'
                    except:
                        return StatusError('RJ', '이미지 업로드를 실패했습니다.')
                elif ext == 'png':
                    try:
                        resize_image = Image.open(upload_path + '/' + file_name + '.' + ext)
                        resize_image = resize_image.convert('RGB')

                        resize_image.thumbnail((1920, 1920), Image.ANTIALIAS)
                        resize_image.save(upload_path + '/' + file_name + '.jpg')
                        os.system('rm ' + upload_path + '/' + file_name + '.png')
                        ext = 'jpg'
                        
                        image_path = upload_path + '/' + file_name + '.' + ext
                        preview_image = resize_image.filter(ImageFilter.GaussianBlur(50))
                        preview_image.save(image_path + '.preview.jpg', quality=50)
                    except:
                        return StatusError('RJ', '이미지 업로드를 실패했습니다.')
                else:
                    try:
                        image_path = upload_path + '/' + file_name + '.' + ext
                        resize_image = Image.open(image_path)
                        resize_image.thumbnail((1920, 1920), Image.ANTIALIAS)
                        resize_image.save(image_path)

                        if not ext == 'jpg':
                            resize_image = resize_image.convert('RGB')
                        preview_image = resize_image.filter(ImageFilter.GaussianBlur(50))
                        preview_image.save(image_path + '.preview.jpg', quality=50)
                    except:
                        return StatusError('RJ', '이미지 업로드를 실패했습니다.')
                image_cache.path = upload_path.replace('static/', '') + '/' + file_name + '.' + ext
                image_cache.save()
                return StatusDone({
                    'url': settings.MEDIA_URL + image_cache.path,
                })
            else:
                return StatusError('RJ', '이미지 파일이 아닙니다.')
    raise Http404
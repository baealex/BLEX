import os
import datetime
import traceback

from django.conf import settings
from django.http import Http404
from PIL import Image, ImageFilter

from board.models import ImageCache
from board.modules.response import StatusDone, StatusError, ErrorCode
from modules.hash import get_sha256
from modules.randomness import randstr
from modules.sysutil import make_path


def image(request):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404

        if not request.FILES['image']:
            return StatusError(ErrorCode.VALIDATE, '이미지가 없습니다.')

        allowed_ext = ['jpg', 'jpeg', 'png', 'gif']

        image = request.FILES['image']
        image_key = get_sha256(image.read())
        image_cache = ImageCache.objects.filter(key=image_key)

        if image_cache.exists():
            return StatusDone({
                'url': settings.MEDIA_URL + image_cache.first().path,
            })

        image_cache = ImageCache(
            key=image_key,
            size=image.size
        )
        ext = str(image).split('.')[-1].lower()

        if not ext in allowed_ext:
            return StatusError(ErrorCode.VALIDATE, '허용된 확장자가 아닙니다.')

        dt = datetime.datetime.now()
        upload_path = make_path([
            'static',
            'images',
            'content',
            str(dt.year),
            str(dt.month),
            str(dt.day)
        ])

        file_name = f'{dt.year}{dt.month}{dt.day}{dt.hour}_{randstr(20)}'
        with open(upload_path + '/' + file_name + '.' + ext, 'wb+') as destination:
            for chunk in image.chunks():
                destination.write(chunk)

        if ext == 'gif':
            try:
                image_path = upload_path + '/' + file_name
                convert_image = Image.open(
                    image_path + '.' + ext).convert('RGB')
                preview_image = convert_image.filter(
                    ImageFilter.GaussianBlur(50))
                preview_image.save(
                    image_path + '.mp4.preview.jpg', quality=50)

                os.system('ffmpeg -i ' + upload_path + '/' + file_name + '.gif' +
                          ' -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart ' + upload_path + '/' + file_name + '.mp4')
                os.system('rm ' + upload_path +
                          '/' + file_name + '.gif')
                ext = 'mp4'
            except:
                return StatusError(ErrorCode.REJECT, '이미지 업로드를 실패했습니다.')

        elif ext == 'png':
            try:
                image_path = upload_path + '/' + file_name + '.' + ext
                image_size = os.stat(image_path).st_size
                resize_image = Image.open(image_path)

                if image_size > 1024 * 1024 * 2:
                    resize_image = resize_image.convert('RGB')
                    ext = 'jpg'

                image_path = upload_path + '/' + file_name + '.' + ext
                resize_image.thumbnail((1920, 1920), Image.LANCZOS)
                resize_image.save(image_path)

                if ext == 'jpg':
                    os.system(f'rm {upload_path}/{file_name}.png')

                if ext == 'png':
                    resize_image = resize_image.convert('RGB')

                preview_image = resize_image.filter(
                    ImageFilter.GaussianBlur(50))
                preview_image.save(
                    image_path + '.preview.jpg', quality=50)
            except:
                traceback.print_exc()
                return StatusError(ErrorCode.REJECT, '이미지 업로드를 실패했습니다.')

        else:
            try:
                image_path = upload_path + '/' + file_name + '.' + ext
                resize_image = Image.open(image_path)
                resize_image.thumbnail((1920, 1920), Image.LANCZOS)
                resize_image.save(image_path)

                if not ext == 'jpg':
                    resize_image = resize_image.convert('RGB')
                preview_image = resize_image.filter(
                    ImageFilter.GaussianBlur(50))
                preview_image.save(
                    image_path + '.preview.jpg', quality=50)
            except:
                return StatusError(ErrorCode.REJECT, '이미지 업로드를 실패했습니다.')
        image_cache.path = upload_path.replace(
            'static/', '') + file_name + '.' + ext
        image_cache.save()
        return StatusDone({
            'url': settings.MEDIA_URL + image_cache.path,
        })

    raise Http404

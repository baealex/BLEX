import datetime
import os
import subprocess
import traceback

import imageio_ffmpeg
from django.conf import settings
from PIL import Image, ImageFilter

from board.models import ImageCache
from modules.hash import get_sha256
from modules.randomness import randstr
from modules.sysutil import make_path


class ImageUploadError(Exception):
    def __init__(self, code, message):
        self.code = code
        self.message = message
        super().__init__(message)


class ImageUploadService:
    ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm'}

    @staticmethod
    def upload_content_image(image, user=None):
        if image is None:
            raise ImageUploadError('image.missing', '이미지가 없습니다.')

        image_key = get_sha256(image.read())
        image.seek(0)
        image_cache = ImageCache.objects.filter(key=image_key).first()

        if image_cache:
            return settings.MEDIA_URL + image_cache.path

        ext = str(image).split('.')[-1].lower()
        if ext not in ImageUploadService.ALLOWED_EXTENSIONS:
            raise ImageUploadError('image.invalid_extension', '허용된 확장자가 아닙니다.')

        image_cache = ImageCache(
            user=user,
            key=image_key,
            size=image.size
        )

        dt = datetime.datetime.now()
        upload_path = make_path([
            'resources',
            'media',
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

        ext = ImageUploadService.process_uploaded_file(upload_path, file_name, ext)
        image_cache.path = upload_path.replace(
            'resources/media/', ''
        ) + file_name + '.' + ext
        image_cache.save()
        return settings.MEDIA_URL + image_cache.path

    @staticmethod
    def process_uploaded_file(upload_path, file_name, ext):
        if ext == 'gif':
            return ImageUploadService.process_gif(upload_path, file_name, ext)
        if ext in ['mp4', 'webm']:
            ImageUploadService.process_video(upload_path, file_name, ext)
            return ext
        if ext == 'png':
            return ImageUploadService.process_png(upload_path, file_name, ext)
        ImageUploadService.process_raster_image(upload_path, file_name, ext)
        return ext

    @staticmethod
    def process_gif(upload_path, file_name, ext):
        try:
            image_path = upload_path + '/' + file_name
            convert_image = Image.open(
                image_path + '.' + ext
            ).convert('RGB')
            preview_image = convert_image.filter(
                ImageFilter.GaussianBlur(50)
            )
            preview_image.save(
                image_path + '.mp4.preview.jpg', quality=50
            )

            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            subprocess.run([
                ffmpeg_exe,
                '-i', f'{upload_path}/{file_name}.gif',
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                f'{upload_path}/{file_name}.mp4'
            ], check=True)
            os.remove(f'{upload_path}/{file_name}.gif')
            return 'mp4'
        except Exception:
            raise ImageUploadError('image.upload_failed', '이미지 업로드를 실패했습니다.')

    @staticmethod
    def process_video(upload_path, file_name, ext):
        try:
            video_path = upload_path + '/' + file_name + '.' + ext
            preview_path = video_path + '.preview.jpg'

            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            subprocess.run([
                ffmpeg_exe,
                '-i', video_path,
                '-ss', '00:00:00',
                '-vframes', '1',
                '-vf', 'scale=480:-1',
                '-q:v', '10',
                preview_path
            ], check=True)

            if os.path.exists(preview_path):
                preview_image = Image.open(preview_path).convert('RGB')
                preview_image = preview_image.filter(ImageFilter.GaussianBlur(50))
                preview_image.save(preview_path, quality=50)
        except Exception:
            traceback.print_exc()
            raise ImageUploadError('image.upload_failed', '비디오 업로드를 실패했습니다.')

    @staticmethod
    def process_png(upload_path, file_name, ext):
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
                ImageFilter.GaussianBlur(50)
            )
            preview_image.save(
                image_path + '.preview.jpg', quality=50
            )
            return ext
        except Exception:
            traceback.print_exc()
            raise ImageUploadError('image.upload_failed', '이미지 업로드를 실패했습니다.')

    @staticmethod
    def process_raster_image(upload_path, file_name, ext):
        try:
            image_path = upload_path + '/' + file_name + '.' + ext
            resize_image = Image.open(image_path)
            resize_image.thumbnail((1920, 1920), Image.LANCZOS)
            resize_image.save(image_path)

            if ext != 'jpg':
                resize_image = resize_image.convert('RGB')
            preview_image = resize_image.filter(
                ImageFilter.GaussianBlur(50)
            )
            preview_image.save(
                image_path + '.preview.jpg', quality=50
            )
        except Exception:
            raise ImageUploadError('image.upload_failed', '이미지 업로드를 실패했습니다.')

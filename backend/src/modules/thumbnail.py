"""
Thumbnail processing module.

Handles image thumbnail generation with different processing modes:
- preview: Blurred low-quality preview for lazy loading
- minify: Smaller version for list views
- normal: Standard resized image
"""
import os
from PIL import Image, ImageFilter
from django.conf import settings


class ThumbnailProcessor:
    """Handles image thumbnail generation with different processing modes."""

    @staticmethod
    def get_image_path(instance) -> str:
        if hasattr(instance.image, 'path'):
            return instance.image.path
        return os.path.join(settings.MEDIA_ROOT, str(instance.image))

    @staticmethod
    def save_preview(image, image_path: str, quality: int):
        preview_image = image.convert('RGB').filter(ImageFilter.GaussianBlur(50))
        preview_path = f"{image_path}.preview.jpg"
        os.makedirs(os.path.dirname(preview_path), exist_ok=True)
        preview_image.save(preview_path, quality=quality)

    @staticmethod
    def save_minify(image, instance, image_path: str, size: int, quality: int):
        image.thumbnail((size, size), Image.LANCZOS)
        ext = str(instance.image).split('.')[-1]
        minify_path = f"{image_path}.minify.{ext}"
        os.makedirs(os.path.dirname(minify_path), exist_ok=True)
        image.save(minify_path, quality=quality)

    @staticmethod
    def save_normal(image, image_path: str, size: int, quality: int):
        image.thumbnail((size, size), Image.LANCZOS)
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        image.save(image_path, quality=quality)

    @classmethod
    def process(cls, instance, size: int, quality: int = 100, thumbnail_type: str = 'normal'):
        if hasattr(instance, 'avatar'):
            instance.image = instance.avatar

        if not instance.image:
            return

        image_path = cls.get_image_path(instance)

        if not os.path.exists(image_path):
            print(f"Warning: Image file not found at {image_path}")
            return

        try:
            image = Image.open(image_path)
        except Exception as e:
            print(f"Error opening image: {e}")
            return

        if thumbnail_type == 'preview':
            cls.save_preview(image, image_path, quality)
        elif thumbnail_type == 'minify':
            cls.save_minify(image, instance, image_path, size, quality)
        else:
            cls.save_normal(image, image_path, size, quality)


def make_thumbnail(instance, size: int, quality: int = 100, thumbnail_type: str = 'normal'):
    """Convenience function for thumbnail processing."""
    ThumbnailProcessor.process(instance, size, quality, thumbnail_type)

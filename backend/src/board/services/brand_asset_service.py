from __future__ import annotations

import hashlib
import json
import re
from io import BytesIO
from typing import Any

from defusedxml import ElementTree
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import HttpRequest
from PIL import Image, UnidentifiedImageError

from board.models import SiteSetting
from board.services.site_url_service import SiteUrlService


class BrandAssetError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class BrandAssetService:
    DEFAULT_SITE_NAME = 'BLEX'
    DEFAULT_SITE_DESCRIPTION = 'BLOG EXPRESS ME'
    LOGO_LIGHT_RESOURCE = 'logob.svg'
    LOGO_DARK_RESOURCE = 'logow.svg'
    FAVICON_RESOURCE = 'favicon.ico'
    ICON_RESOURCE_TEMPLATE = 'logo{size}.png'

    SVG_MAX_BYTES = 256 * 1024
    PNG_MAX_BYTES = 512 * 1024
    ICO_MAX_BYTES = 1024 * 1024
    MAX_XML_NODES = 300
    REQUIRED_ICON_PNG_SIZES = (16, 32, 57, 72, 76, 96, 114, 120, 128, 144, 152, 192, 256, 512)

    SVG_ALLOWED_TAGS = {
        'svg', 'g', 'defs', 'title', 'desc',
        'style',
        'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
        'linearGradient', 'radialGradient', 'stop',
        'text', 'tspan',
    }
    SVG_ALLOWED_ATTRIBUTES = {
        'xmlns', 'viewBox', 'width', 'height', 'class', 'style', 'type', 'fill', 'stroke', 'stroke-width',
        'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
        'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity',
        'stroke-opacity', 'd', 'points', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
        'cx', 'cy', 'r', 'rx', 'ry', 'transform', 'gradientUnits',
        'gradientTransform', 'offset', 'stop-color', 'stop-opacity', 'id',
        'role', 'aria-hidden', 'focusable', 'xml:space', 'font-family',
        'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
        'letter-spacing', 'fill-rule', 'clip-rule', 'version',
        'preserveAspectRatio',
    }
    DANGEROUS_VALUE_PATTERN = re.compile(
        r'(javascript:|https?:|//|data:|@import)',
        re.IGNORECASE,
    )
    EXTERNAL_URL_PATTERN = re.compile(r'url\(\s*(?!#|\'#|"#)', re.IGNORECASE)
    PROCESSING_INSTRUCTION_PATTERN = re.compile(rb'<\?(?!xml\s)[\s\S]*?\?>', re.IGNORECASE)
    DOCTYPE_PATTERN = re.compile(rb'<!DOCTYPE', re.IGNORECASE)

    @staticmethod
    def site_name(setting: SiteSetting | None = None) -> str:
        setting = setting or SiteSetting.get_instance()
        return (setting.site_name or BrandAssetService.DEFAULT_SITE_NAME).strip()

    @staticmethod
    def site_description(setting: SiteSetting | None = None) -> str:
        name = BrandAssetService.site_name(setting)
        if name == BrandAssetService.DEFAULT_SITE_NAME:
            return BrandAssetService.DEFAULT_SITE_DESCRIPTION
        return f'{name} recent public posts'

    @staticmethod
    def resource_url(path: str) -> str:
        return settings.RESOURCE_URL + path

    @staticmethod
    def media_url(path: str) -> str:
        return settings.MEDIA_URL + path

    @staticmethod
    def stored_media_url(path: str | None) -> str | None:
        if path and default_storage.exists(path):
            return BrandAssetService.media_url(path)
        return None

    @staticmethod
    def stored_field_url(field) -> str | None:
        return BrandAssetService.stored_media_url(field.name if field and field.name else None)

    @staticmethod
    def logo_url(setting: SiteSetting | None = None, *, dark: bool = False) -> str:
        setting = setting or SiteSetting.get_instance()
        if dark:
            if logo_dark_url := BrandAssetService.stored_field_url(setting.logo_svg_dark):
                return logo_dark_url
            if logo_url := BrandAssetService.stored_field_url(setting.logo_svg):
                return logo_url
            return BrandAssetService.resource_url(BrandAssetService.LOGO_DARK_RESOURCE)

        if logo_url := BrandAssetService.stored_field_url(setting.logo_svg):
            return logo_url
        return BrandAssetService.resource_url(BrandAssetService.LOGO_LIGHT_RESOURCE)

    @staticmethod
    def icon_svg_url(setting: SiteSetting | None = None, *, dark: bool = False) -> str:
        setting = setting or SiteSetting.get_instance()
        if dark:
            if icon_dark_url := BrandAssetService.stored_field_url(setting.icon_svg_dark):
                return icon_dark_url
            if icon_url := BrandAssetService.stored_field_url(setting.icon_svg):
                return icon_url
            return BrandAssetService.icon_png_url(setting, 512)

        if icon_url := BrandAssetService.stored_field_url(setting.icon_svg):
            return icon_url
        return BrandAssetService.icon_png_url(setting, 512)

    @staticmethod
    def icon_png_url(setting: SiteSetting | None, size: int) -> str:
        setting = setting or SiteSetting.get_instance()
        path = (setting.icon_manifest or {}).get('png', {}).get(str(size))
        if icon_url := BrandAssetService.stored_media_url(path):
            return icon_url
        return BrandAssetService.resource_url(
            BrandAssetService.ICON_RESOURCE_TEMPLATE.format(size=size)
        )

    @staticmethod
    def favicon_url(setting: SiteSetting | None = None) -> str:
        setting = setting or SiteSetting.get_instance()
        path = (setting.icon_manifest or {}).get('ico')
        if favicon_url := BrandAssetService.stored_media_url(path):
            return favicon_url
        return BrandAssetService.resource_url(BrandAssetService.FAVICON_RESOURCE)

    @staticmethod
    def absolute_icon_png_url(request: HttpRequest, setting: SiteSetting | None, size: int) -> str:
        return SiteUrlService.absolute_url(
            request,
            BrandAssetService.icon_png_url(setting, size),
        )

    @staticmethod
    def public_context(setting: SiteSetting | None = None) -> dict[str, Any]:
        setting = setting or SiteSetting.get_instance()
        icon_png_urls = {
            str(size): BrandAssetService.icon_png_url(setting, size)
            for size in BrandAssetService.REQUIRED_ICON_PNG_SIZES
        }
        context = {
            'site_name': BrandAssetService.site_name(setting),
            'site_description': BrandAssetService.site_description(setting),
            'logo_url': BrandAssetService.logo_url(setting),
            'logo_dark_url': BrandAssetService.logo_url(setting, dark=True),
            'icon_svg_url': BrandAssetService.icon_svg_url(setting),
            'icon_svg_dark_url': BrandAssetService.icon_svg_url(setting, dark=True),
            'favicon_url': BrandAssetService.favicon_url(setting),
            'icon_png_urls': icon_png_urls,
            'has_custom_logo': bool(setting.logo_svg),
            'has_custom_logo_dark': bool(setting.logo_svg_dark),
            'has_custom_icon': bool(setting.icon_svg),
            'has_custom_icon_dark': bool(setting.icon_svg_dark),
        }
        context.update({
            f'icon_png_{size}_url': icon_png_urls[str(size)]
            for size in BrandAssetService.REQUIRED_ICON_PNG_SIZES
        })
        return context

    @staticmethod
    def serialize_setting(setting: SiteSetting) -> dict[str, Any]:
        context = BrandAssetService.public_context(setting)
        return {
            'site_name': context['site_name'],
            'site_description': context['site_description'],
            'logo_svg_url': context['logo_url'],
            'logo_svg_dark_url': context['logo_dark_url'],
            'icon_svg_url': context['icon_svg_url'],
            'icon_svg_dark_url': context['icon_svg_dark_url'],
            'favicon_url': context['favicon_url'],
            'icon_png_urls': context['icon_png_urls'],
            'has_custom_logo': context['has_custom_logo'],
            'has_custom_logo_dark': context['has_custom_logo_dark'],
            'has_custom_icon': context['has_custom_icon'],
            'has_custom_icon_dark': context['has_custom_icon_dark'],
        }

    @staticmethod
    def upload_asset(
        setting: SiteSetting,
        *,
        asset_type: str,
        theme: str,
        svg_file,
        files,
        manifest_raw: str = '',
    ) -> SiteSetting:
        BrandAssetService.validate_asset_target(asset_type, theme)

        if theme == 'dark' and not BrandAssetService.has_default_asset(setting, asset_type):
            raise BrandAssetError('기본 자산을 먼저 업로드해주세요.')

        svg_bytes = BrandAssetService.validate_svg(svg_file)
        asset_hash = hashlib.sha256(svg_bytes).hexdigest()[:16]
        base_path = f'brand/{asset_type}/{theme}/{asset_hash}'
        old_paths = BrandAssetService.collect_asset_paths(setting, asset_type, theme)
        old_path_set = set(old_paths)
        new_paths: list[str] = []
        manifest = None
        png_contents: dict[int, bytes] = {}
        ico_bytes = None

        if asset_type == 'icon' and theme == 'default':
            manifest = BrandAssetService.parse_icon_manifest(manifest_raw)
            for size in BrandAssetService.REQUIRED_ICON_PNG_SIZES:
                field_name = f'png_{size}'
                png_contents[size] = BrandAssetService.validate_png(files.get(field_name), size)
            ico_bytes = BrandAssetService.validate_ico(files.get('favicon_ico'))

        try:
            svg_path = f'{base_path}/{asset_type}.svg'
            BrandAssetService.save_storage_file(svg_path, svg_bytes)
            new_paths.append(svg_path)

            if asset_type == 'icon' and theme == 'default':
                png_paths = {}
                for size, png_bytes in png_contents.items():
                    png_path = f'{base_path}/logo{size}.png'
                    BrandAssetService.save_storage_file(png_path, png_bytes)
                    png_paths[str(size)] = png_path
                    new_paths.append(png_path)

                ico_path = f'{base_path}/favicon.ico'
                BrandAssetService.save_storage_file(ico_path, ico_bytes)
                new_paths.append(ico_path)

                setting.icon_manifest = {
                    'version': 1,
                    'hash': asset_hash,
                    'png': png_paths,
                    'ico': ico_path,
                    'source': manifest,
                }

            BrandAssetService.set_asset_field(setting, asset_type, theme, svg_path)
            setting.save()
        except Exception:
            BrandAssetService.delete_storage_files(path for path in new_paths if path not in old_path_set)
            raise

        BrandAssetService.delete_storage_files(path for path in old_paths if path not in new_paths)
        return setting

    @staticmethod
    def delete_asset(setting: SiteSetting, *, asset_type: str, theme: str) -> SiteSetting:
        BrandAssetService.validate_asset_target(asset_type, theme)
        old_paths = BrandAssetService.collect_asset_paths(
            setting,
            asset_type,
            theme,
            include_related_dark=theme == 'default',
        )

        if asset_type == 'logo' and theme == 'default':
            setting.logo_svg = ''
            setting.logo_svg_dark = ''
        elif asset_type == 'logo':
            setting.logo_svg_dark = ''
        elif asset_type == 'icon' and theme == 'default':
            setting.icon_svg = ''
            setting.icon_svg_dark = ''
            setting.icon_manifest = {}
        else:
            setting.icon_svg_dark = ''

        setting.save()
        BrandAssetService.delete_storage_files(old_paths)
        return setting

    @staticmethod
    def validate_asset_target(asset_type: str, theme: str) -> None:
        if asset_type not in {'logo', 'icon'}:
            raise BrandAssetError('브랜드 자산 종류를 확인해주세요.')
        if theme not in {'default', 'dark'}:
            raise BrandAssetError('브랜드 자산 테마를 확인해주세요.')

    @staticmethod
    def has_default_asset(setting: SiteSetting, asset_type: str) -> bool:
        return bool(setting.logo_svg if asset_type == 'logo' else setting.icon_svg)

    @staticmethod
    def set_asset_field(setting: SiteSetting, asset_type: str, theme: str, path: str) -> None:
        field_name = {
            ('logo', 'default'): 'logo_svg',
            ('logo', 'dark'): 'logo_svg_dark',
            ('icon', 'default'): 'icon_svg',
            ('icon', 'dark'): 'icon_svg_dark',
        }[(asset_type, theme)]
        setattr(setting, field_name, path)

    @staticmethod
    def collect_asset_paths(
        setting: SiteSetting,
        asset_type: str,
        theme: str,
        *,
        include_related_dark: bool = False,
    ) -> list[str]:
        paths: list[str] = []
        if asset_type == 'logo':
            if theme == 'default':
                paths.extend(BrandAssetService.field_paths(setting.logo_svg))
                if include_related_dark:
                    paths.extend(BrandAssetService.field_paths(setting.logo_svg_dark))
            else:
                paths.extend(BrandAssetService.field_paths(setting.logo_svg_dark))
            return paths

        if theme == 'default':
            paths.extend(BrandAssetService.field_paths(setting.icon_svg))
            if include_related_dark:
                paths.extend(BrandAssetService.field_paths(setting.icon_svg_dark))
            manifest = setting.icon_manifest or {}
            paths.extend(manifest.get('png', {}).values())
            if manifest.get('ico'):
                paths.append(manifest['ico'])
        else:
            paths.extend(BrandAssetService.field_paths(setting.icon_svg_dark))
        return paths

    @staticmethod
    def field_paths(*fields) -> list[str]:
        return [field.name for field in fields if field and field.name]

    @staticmethod
    def read_upload(uploaded_file, *, max_bytes: int, label: str) -> bytes:
        if not uploaded_file:
            raise BrandAssetError(f'{label} 파일이 필요합니다.')

        content = uploaded_file.read()
        uploaded_file.seek(0)
        if len(content) > max_bytes:
            raise BrandAssetError(f'{label} 파일이 너무 큽니다.')
        if not content:
            raise BrandAssetError(f'{label} 파일이 비어 있습니다.')
        return content

    @staticmethod
    def validate_svg(uploaded_file) -> bytes:
        content = BrandAssetService.read_upload(
            uploaded_file,
            max_bytes=BrandAssetService.SVG_MAX_BYTES,
            label='SVG',
        )
        if BrandAssetService.PROCESSING_INSTRUCTION_PATTERN.search(content):
            raise BrandAssetError('SVG 처리 지시자는 허용되지 않습니다.')
        if BrandAssetService.DOCTYPE_PATTERN.search(content):
            raise BrandAssetError('SVG DOCTYPE은 허용되지 않습니다.')

        try:
            root = ElementTree.fromstring(content)
        except ElementTree.ParseError as error:
            raise BrandAssetError('올바른 SVG 파일이 아닙니다.') from error

        if BrandAssetService.local_name(root.tag) != 'svg':
            raise BrandAssetError('SVG 루트 요소를 확인해주세요.')
        if not root.attrib.get('viewBox'):
            raise BrandAssetError('SVG에는 viewBox가 필요합니다.')

        node_count = 0
        for element in root.iter():
            node_count += 1
            if node_count > BrandAssetService.MAX_XML_NODES:
                raise BrandAssetError('SVG 구조가 너무 복잡합니다.')

            tag_name = BrandAssetService.local_name(element.tag)
            if tag_name not in BrandAssetService.SVG_ALLOWED_TAGS:
                raise BrandAssetError(f'허용되지 않는 SVG 요소입니다: {tag_name}')

            for raw_name, value in element.attrib.items():
                attr_name = BrandAssetService.local_name(raw_name)
                if attr_name.lower().startswith('on'):
                    raise BrandAssetError('허용되지 않는 SVG 속성이 포함되어 있습니다.')
                if (
                    attr_name not in BrandAssetService.SVG_ALLOWED_ATTRIBUTES
                    and not BrandAssetService.is_safe_metadata_attribute(attr_name)
                ):
                    raise BrandAssetError(f'허용되지 않는 SVG 속성입니다: {attr_name}')
                if BrandAssetService.has_dangerous_value(value):
                    raise BrandAssetError('SVG에 외부 참조 또는 위험한 값이 포함되어 있습니다.')

            if element.text and BrandAssetService.has_dangerous_value(element.text):
                raise BrandAssetError('SVG 텍스트에 위험한 값이 포함되어 있습니다.')

        return content

    @staticmethod
    def local_name(name: str) -> str:
        return name.rsplit('}', 1)[-1]

    @staticmethod
    def has_dangerous_value(value: str) -> bool:
        return bool(
            BrandAssetService.DANGEROUS_VALUE_PATTERN.search(value)
            or BrandAssetService.EXTERNAL_URL_PATTERN.search(value)
        )

    @staticmethod
    def is_safe_metadata_attribute(name: str) -> bool:
        return name.startswith('data-') or name.startswith('aria-')

    @staticmethod
    def parse_icon_manifest(raw: str) -> dict[str, Any]:
        if not raw:
            raise BrandAssetError('아이콘 manifest가 필요합니다.')
        try:
            manifest = json.loads(raw)
        except json.JSONDecodeError as error:
            raise BrandAssetError('아이콘 manifest 형식을 확인해주세요.') from error

        sizes = manifest.get('pngSizes')
        if sizes != list(BrandAssetService.REQUIRED_ICON_PNG_SIZES):
            raise BrandAssetError('아이콘 manifest의 PNG 크기 목록을 확인해주세요.')
        if manifest.get('ico') is not True:
            raise BrandAssetError('아이콘 manifest의 ICO 정보를 확인해주세요.')
        return manifest

    @staticmethod
    def validate_png(uploaded_file, expected_size: int) -> bytes:
        content = BrandAssetService.read_upload(
            uploaded_file,
            max_bytes=BrandAssetService.PNG_MAX_BYTES,
            label=f'{expected_size}x{expected_size} PNG',
        )
        try:
            with Image.open(BytesIO(content)) as image:
                if image.format != 'PNG':
                    raise BrandAssetError('PNG 파일 형식을 확인해주세요.')
                if image.size != (expected_size, expected_size):
                    raise BrandAssetError(f'{expected_size}x{expected_size} PNG 크기를 확인해주세요.')
                image.load()
        except (UnidentifiedImageError, OSError) as error:
            raise BrandAssetError('PNG 파일을 읽을 수 없습니다.') from error
        return content

    @staticmethod
    def validate_ico(uploaded_file) -> bytes:
        content = BrandAssetService.read_upload(
            uploaded_file,
            max_bytes=BrandAssetService.ICO_MAX_BYTES,
            label='favicon.ico',
        )
        try:
            with Image.open(BytesIO(content)) as image:
                if image.format != 'ICO':
                    raise BrandAssetError('ICO 파일 형식을 확인해주세요.')
                image.load()
        except (UnidentifiedImageError, OSError) as error:
            raise BrandAssetError('ICO 파일을 읽을 수 없습니다.') from error
        return content

    @staticmethod
    def save_storage_file(path: str, content: bytes) -> None:
        if default_storage.exists(path):
            default_storage.delete(path)
        default_storage.save(path, ContentFile(content))

    @staticmethod
    def delete_storage_files(paths) -> None:
        for path in paths:
            if path and default_storage.exists(path):
                default_storage.delete(path)

"""Check the decoder reached through Pillow's actual FreeType dependency graph."""

import ctypes
import sysconfig
from pathlib import Path

from PIL import ImageFont


library = ctypes.CDLL(ImageFont.core.__file__)
library.BrotliDecoderVersion.restype = ctypes.c_uint32
library.BrotliDecoderErrorString.restype = ctypes.c_char_p
version = library.BrotliDecoderVersion()
minimum = (1 << 24) | (2 << 12) | 1
if version < minimum:
    raise RuntimeError('Pillow is loading an outdated Brotli decoder')
if library.BrotliDecoderErrorString(-17) != b'_ERROR_FORMAT_BLOCK_SWITCH':
    raise RuntimeError('Pillow Brotli decoder is missing the CVE-2026-111497 fix')

libraries = Path(sysconfig.get_path('platlib')) / 'pillow.libs'
for decoder in libraries.glob('libbrotlidec*.so*'):
    bundled = ctypes.CDLL(str(decoder))
    bundled.BrotliDecoderVersion.restype = ctypes.c_uint32
    if bundled.BrotliDecoderVersion() < minimum:
        raise RuntimeError(f'Unpatched bundled Brotli remains: {decoder.name}')

print('Pillow Brotli decoder:', f'{version >> 24}.{(version >> 12) & 4095}.{version & 4095}',
      '(CVE-2026-111497 fix verified)')

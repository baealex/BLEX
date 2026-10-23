"""Replace Pillow's bundled Brotli until its upstream wheels include the fix."""

import base64
import csv
import ctypes
import hashlib
import json
import shutil
import subprocess
import sys
import sysconfig
from pathlib import Path


prefix, native_prefix, version, source_sha256 = sys.argv[1:]
site_packages = Path(sysconfig.get_path(
    'platlib', vars={'base': prefix, 'platbase': prefix},
))
libraries = site_packages / 'pillow.libs'
distribution, = site_packages.glob('pillow-*.dist-info')
decoder, = libraries.glob('libbrotlidec*.so*')
upstream = ctypes.CDLL(str(decoder))
upstream.BrotliDecoderVersion.restype = ctypes.c_uint32
upstream.BrotliDecoderErrorString.restype = ctypes.c_char_p
major, minor, patch = map(int, version.split('.'))
minimum = (major << 24) | (minor << 12) | patch
if upstream.BrotliDecoderVersion() >= minimum:
    if upstream.BrotliDecoderErrorString(-17) != b'_ERROR_FORMAT_BLOCK_SWITCH':
        raise RuntimeError('Unexpected upstream Brotli decoder; review before replacing')
    print('Pillow upstream already includes patched Brotli; native override skipped')
    raise SystemExit(0)

replacements = {}
removed = set()
added = []

for name in ('brotlicommon', 'brotlidec'):
    source, = (
        path for path in (Path(native_prefix) / 'lib').glob(f'lib{name}.so.*')
        if not path.is_symlink()
    )
    target = libraries / source.name
    for old in libraries.glob(f'lib{name}-*.so.*'):
        replacements[old.name] = target.name
        removed.add(old)
    replacements[f'lib{name}.so.1'] = target.name
    shutil.copy2(source, target)
    subprocess.run(['patchelf', '--set-soname', target.name, str(target)], check=True)
    subprocess.run(['patchelf', '--set-rpath', '$ORIGIN', str(target)], check=True)
    added.append(target)

assert removed, 'Expected Pillow bundled Brotli libraries were not found'
for library in [*libraries.glob('*.so*'), *(site_packages / 'PIL').glob('*.so')]:
    if library in removed:
        continue
    needed = subprocess.check_output(
        ['patchelf', '--print-needed', str(library)], text=True,
    ).splitlines()
    for dependency in needed:
        if dependency in replacements:
            subprocess.run([
                'patchelf', '--replace-needed', dependency,
                replacements[dependency], str(library),
            ], check=True)
for library in removed:
    library.unlink()

sbom, = (distribution / 'sboms').glob('pillow-*.cdx.json')
metadata = json.loads(sbom.read_text())
metadata['version'] += 1
reference = f'pkg:generic/brotli@{version}'
metadata['components'].append({
    'type': 'library', 'name': 'brotli', 'version': version,
    'bom-ref': reference, 'purl': reference,
    'externalReferences': [{
        'type': 'distribution',
        'url': f'https://github.com/google/brotli/archive/refs/tags/v{version}.tar.gz',
        'hashes': [{'alg': 'SHA-256', 'content': source_sha256}],
    }],
    'licenses': [{'license': {'id': 'MIT'}}],
})
freetype, = (
    item for item in metadata['components'] if item['name'] == 'FreeType'
)
dependency = next((
    item for item in metadata['dependencies']
    if item['ref'] == freetype['bom-ref']
), None)
if dependency is None:
    dependency = {'ref': freetype['bom-ref'], 'dependsOn': []}
    metadata['dependencies'].append(dependency)
dependency.setdefault('dependsOn', []).append(reference)
sbom.write_text(json.dumps(metadata, indent=2) + '\n')

record = distribution / 'RECORD'
with record.open(newline='') as stream:
    rows = list(csv.reader(stream))
paths = [site_packages / row[0] for row in rows]
paths = [path for path in paths if path not in removed]
paths.extend(added)
with record.open('w', newline='') as stream:
    writer = csv.writer(stream)
    for path in paths:
        relative = path.relative_to(site_packages).as_posix()
        if path == record:
            writer.writerow([relative, '', ''])
            continue
        content = path.read_bytes()
        digest = base64.urlsafe_b64encode(hashlib.sha256(content).digest())
        writer.writerow([relative, 'sha256=' + digest.rstrip(b'=').decode(), len(content)])

license_dir = Path(prefix) / 'share' / 'licenses' / 'brotli'
license_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(Path(native_prefix) / 'LICENSE', license_dir / 'LICENSE')

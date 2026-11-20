import os
import re
from collections.abc import Iterator
from typing import BinaryIO

from django.http import FileResponse, Http404, HttpRequest, HttpResponse, StreamingHttpResponse

from board.models.work_logs import WorkLogEntry


class WorkLogFileRange:
    block_size = 64 * 1024

    def __init__(self, file: BinaryIO, start: int, length: int) -> None:
        self.file = file
        self.remaining = length
        file.seek(start)

    def __iter__(self) -> Iterator[bytes]:
        while self.remaining:
            chunk = self.file.read(min(self.remaining, self.block_size))
            if not chunk:
                break
            self.remaining -= len(chunk)
            yield chunk

    def close(self) -> None:
        self.file.close()


class WorkLogMedia:
    @staticmethod
    def response(request: HttpRequest, entry: WorkLogEntry) -> HttpResponse | StreamingHttpResponse:
        try:
            file = entry.attachment.storage.open(entry.attachment.name, 'rb')
        except FileNotFoundError as error:
            raise Http404 from error

        try:
            return WorkLogMedia.file_response(request, entry, file)
        except BaseException:
            file.close()
            raise

    @staticmethod
    def file_response(
        request: HttpRequest, entry: WorkLogEntry, file: BinaryIO,
    ) -> HttpResponse | StreamingHttpResponse:
        size = os.fstat(file.fileno()).st_size
        media_type = entry.media_type
        headers = {'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff'}
        match = re.fullmatch(r'bytes=(\d{0,18})-(\d{0,18})', request.headers.get('Range', ''))
        if match and any(match.groups()):
            first, last = match.groups()
            start = int(first) if first else max(0, size - int(last))
            end = min(size - 1, int(last)) if first and last else size - 1
            if start > end:
                file.close()
                headers['Content-Range'] = f'bytes */{size}'
                return HttpResponse(status=416, headers=headers)

            length = end - start + 1
            headers.update({
                'Content-Range': f'bytes {start}-{end}/{size}',
                'Content-Length': str(length),
            })
            if request.method == 'HEAD':
                file.close()
                return HttpResponse(status=206, content_type=media_type, headers=headers)
            return StreamingHttpResponse(
                WorkLogFileRange(file, start, length), status=206, content_type=media_type, headers=headers,
            )

        if request.method == 'HEAD':
            file.close()
            headers['Content-Length'] = str(size)
            return HttpResponse(content_type=media_type, headers=headers)
        return FileResponse(file, content_type=media_type, headers=headers)

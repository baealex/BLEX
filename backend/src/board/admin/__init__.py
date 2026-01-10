from .auth import *
from .banner import *
from .comment import *
from .connection import *
from .developer import *
from .form import *
from .global_notice import *
from .image import *
from .notify import *
from .series import *
from .site import *
from .post import *
from .tag import *
from .user import *
from .utility import *

from django.contrib import admin
from django.contrib.admin.models import LogEntry


# 어드민 사이트 커스터마이징
admin.site.site_header = 'BLEX 관리자'
admin.site.site_title = 'BLEX Admin'
admin.site.index_title = '대시보드'

admin.site.register(LogEntry)

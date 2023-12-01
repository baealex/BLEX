from .auth import *
from .comment import *
from .connection import *
from .developer import *
from .form import *
from .image import *
from .notify import *
from .user import *
from .referer import *
from .search import *
from .series import *
from .post import *

from django.contrib import admin
from django.contrib.admin.models import LogEntry


admin.site.register(LogEntry)

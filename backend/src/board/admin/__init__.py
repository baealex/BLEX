from .auth import *
from .comment import *
from .connection import *
from .developer import *
from .form import *
from .image import *
from .notify import *
from .series import *
from .site import *
from .post import *
from .tag import *
from .user import *

from django.contrib import admin
from django.contrib.admin.models import LogEntry


admin.site.register(LogEntry)

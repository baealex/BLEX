import re

from django.utils.safestring import mark_safe


class AdminDisplayService:
    @staticmethod
    def check_mark(obj):
        return '✅' if obj else '❌'

    @staticmethod
    def html(html, remove_lazy_load=False, use_folding=False):
        if remove_lazy_load:
            html = re.sub(r' src="[^"]*"', '', html)
            html = re.sub(r' data-src="([^"]*)"', r' src="\1"', html)
        if use_folding:
            html = '<details><summary>View Detail</summary><div style="overflow-x: auto;">' + html + '</div></details>'
        return mark_safe(html)
    
    @staticmethod
    def image(image_path, image_size='480px'):
        return mark_safe('<img src="{}" lazy="loading" width="{}"/>'.format(image_path, image_size))
    
    @staticmethod
    def video(video_path, image_size='480px'):
        return mark_safe('<video src="{}" controls autoplay loop muted playsinline width="{}"></video>'.format(video_path, image_size))
    
    @staticmethod
    def link(link, text = '🔗'):
        return mark_safe('<a href="{}">{}</a>'.format(link, text))
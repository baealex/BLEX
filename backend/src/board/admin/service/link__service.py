from django.urls import reverse
from django.utils.safestring import mark_safe

class AdminLinkService:
    @staticmethod
    def create_user_link(user):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(user.id,)), user.username))
    
    @staticmethod
    def create_post_link(post):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_post_change', args=(post.id,)), post.title))
    
    @staticmethod
    def create_post_content_link(post_content):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_postcontent_change', args=(post_content.id,)), '🚀'))
    
    @staticmethod
    def create_post_config_link(post_config):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_postconfig_change', args=(post_config.id,)), '🚀'))
    
    @staticmethod
    def create_series_link(series):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_series_change', args=(series.id,)), series.name))
    
    @staticmethod
    def create_referer_from_link(referer_from):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_refererfrom_change', args=(referer_from.id,)), referer_from.title if referer_from.title else referer_from.location))
from django import template
from django.utils.html import strip_tags

register = template.Library()

def read_time(value):
    return int(len(strip_tags(value))/500)

def get_type(element):
    return str(type(element))

register.filter('read_time', read_time)
register.filter('get_type', get_type)
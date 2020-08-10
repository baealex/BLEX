from django import template
from django.utils.html import strip_tags

from board.module.blexer import Blexer

register = template.Library()

def read_time(value):
    return int(len(strip_tags(value))/500)

def get_type(element):
    return str(type(element))

def blexer(text):
    return Blexer().to_html(text)

register.filter('read_time', read_time)
register.filter('get_type', get_type)
register.filter('blexer', blexer)
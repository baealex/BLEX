from django import template

register = template.Library()

def div(value, arg):
    return int(value/arg)

register.filter('div', div)
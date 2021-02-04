import requests
import datetime
import random
import time
import pytz

from django.db import models
from django.db.models import Sum, Count
from django.contrib.auth.models import User
from django.template.loader import render_to_string
from django.template.defaultfilters import linebreaks, truncatewords
from django.urls import reverse
from django.utils import timezone
from django.utils.html import escape, strip_tags
from django.utils.timesince import timesince
from django.conf import settings

from PIL import Image

def convert_to_localtime(utctime):
    utc = utctime.replace(tzinfo=pytz.UTC)
    localtz = utc.astimezone(timezone.get_current_timezone())
    return localtz

def randstr(length):
    rstr = '0123456789abcdefghijklnmopqrstuvwxyzABCDEFGHIJKLNMOPQRSTUVWXYZ'
    rstr_len = len(rstr) - 1
    result = ''
    for i in range(length):
        result += rstr[random.randint(0, rstr_len)]
    return result

def parsedown(text):
    return 'Deprecated'

def avatar_path(instance, filename):
    dt = datetime.datetime.now()
    return 'images/avatar/u/' + instance.user.username + '/' + randstr(4) + '.' + filename.split('.')[-1]

def title_image_path(instance, filename):
    dt = datetime.datetime.now()
    return 'images/title/' + '/' + str(dt.year) + '/' + str(dt.month) + '/' + str(dt.day) + '/' + instance.author.username + '/' + str(dt.hour) + '_' + randstr(8) + '.' + filename.split('.')[-1]

def make_thumbnail(this, size, save_as=False, quality=100):
    if hasattr(this, 'avatar'):
        this.image = this.avatar
    image = Image.open(this.image)
    if not save_as:
        image.thumbnail((size, size), Image.ANTIALIAS)
        image.save('static/' + str(this.image), quality=quality)
        return
    image.thumbnail((size, size), Image.ANTIALIAS)
    image.save('static/' + str(this.image) + '.minify.' + str(this.image).split('.')[-1], quality=quality)

def timestamp(date, kind=''):
    if kind == 'grass':
        date = date + datetime.timedelta(hours=9)
        date = date.replace(hour=12, minute=0, second=0)

    timestamp = str(date.timestamp()).replace('.', '')
    timestamp = timestamp + '0' * (16 - len(timestamp))
    return timestamp

class ImageCache(models.Model):
    key  = models.CharField(max_length=44, unique=True)
    path = models.CharField(max_length=128, unique=True)

class History(models.Model):
    key      = models.CharField(max_length=44, unique=True)
    agent    = models.CharField(max_length=200)
    category = models.CharField(max_length=15, blank=True)

    def __str__(self):
        return str(self.id)

class Grade(models.Model):
    name = models.CharField(max_length=30, unique=True)

    def __str__(self):
        return self.name

class Config(models.Model):
    user           = models.OneToOneField(User, on_delete=models.CASCADE)
    agree_email    = models.BooleanField(default=False)
    agree_history  = models.BooleanField(default=False)
    telegram_token = models.CharField(max_length=8, blank=True)
    telegram_id    = models.CharField(max_length=15, blank=True)
    password_qna   = models.TextField(blank=True)

    def __str__(self):
        return self.user.username

class Profile(models.Model):
    user       = models.OneToOneField(User, on_delete=models.CASCADE)
    subscriber = models.ManyToManyField(User, through='Follow', related_name='following', blank=True)
    grade      = models.ForeignKey('board.Grade', on_delete=models.CASCADE, blank=True, null=True)
    exp        = models.IntegerField(default=0)
    bio        = models.TextField(max_length=500, blank=True)
    avatar     = models.ImageField(blank=True, upload_to=avatar_path)
    github     = models.CharField(max_length=15, blank=True)
    twitter    = models.CharField(max_length=15, blank=True)
    youtube    = models.CharField(max_length=30, blank=True)
    facebook   = models.CharField(max_length=30, blank=True)
    instagram  = models.CharField(max_length=15, blank=True)
    homepage   = models.CharField(max_length=100, blank=True)
    about_md   = models.TextField()
    about_html = models.TextField()

    def collect_social(self):
        result = dict()
        if self.github:
            result['github'] = self.github
        if self.twitter:
            result['twitter'] = self.twitter
        if self.youtube:
            result['youtube'] = self.youtube
        if self.facebook:
            result['facebook'] = self.facebook
        if self.instagram:
            result['instagram'] = self.instagram
        return result

    def get_thumbnail(self):
        if self.avatar:
            return self.avatar.url
        else:
            return settings.STATIC_URL + '/images/default-avatar.jpg'

    def __str__(self):
        return self.user.username
    
    def total_subscriber(self):
        return self.subscriber.count()

    def save(self, *args, **kwargs):
        will_make_thumbnail = False
        if not self.pk and self.avatar:
            will_make_thumbnail = True
        try:
            this = Profile.objects.get(id=self.id)
            if this.avatar != self.avatar:
                this.avatar.delete(save=False)
                will_make_thumbnail = True
        except:
            pass
        super(Profile, self).save(*args, **kwargs)
        if will_make_thumbnail:
            make_thumbnail(self, size=500)
    
    def get_absolute_url(self):
        return reverse('user_profile', args=[self.user])

class Follow(models.Model):
    class Meta:
        db_table = 'board_user_follow'
        auto_created = True
    
    following    = models.ForeignKey(Profile, on_delete=models.CASCADE)
    follower     = models.ForeignKey(User, on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.post.title

class TempPosts(models.Model):
    author            = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title             = models.CharField(max_length=50)
    token             = models.CharField(max_length=50)
    text_md           = models.TextField(blank=True)
    tag               = models.CharField(max_length=50)
    created_date      = models.DateTimeField(default=timezone.now)

    def to_dict(self):
        return {
            'title': self.title,
            'token': self.token,
            'text_md': self.text_md,
            'tag': self.tag,
            'created_date': timesince(self.created_date),
        }
    
    def __str__(self):
        return self.title

class Post(models.Model):
    author        = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title         = models.CharField(max_length=50)
    url           = models.SlugField(max_length=65, unique=True, allow_unicode=True)
    image         = models.ImageField(blank=True, upload_to=title_image_path)
    text_md       = models.TextField(blank=True)
    text_html     = models.TextField()
    series        = models.ForeignKey('board.Series', on_delete=models.SET_NULL, null=True, blank=True)
    hide          = models.BooleanField(default=False)
    notice        = models.BooleanField(default=False)
    block_comment = models.BooleanField(default=False)
    likes         = models.ManyToManyField(User, through='PostLikes', related_name='like_posts', blank=True)
    tag           = models.CharField(max_length=50)
    created_date  = models.DateTimeField(default=timezone.now)
    updated_date  = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return self.title

    def get_image(self):
        if self.image:
            return self.image.url
        else:
            return settings.STATIC_URL + '/images/default-post.png'

    def timestamp(self):
        return timestamp(self.created_date)

    def get_absolute_url(self):
        return reverse('post_detail', args=[self.author, self.url])

    def total_likes(self):
        return self.likes.count()
    
    def total_comment(self):
        return self.comments.count()
    
    def description(self, count=25):
        return truncatewords(strip_tags(self.text_html), count % 150)
    
    def read_time(self):
        return int(len(strip_tags(self.text_html))/500)
    
    def today(self):
        count = 0
        try:
            today = convert_to_localtime(timezone.make_aware(datetime.datetime.now()))
            count = PostAnalytics.objects.get(created_date=today, posts=self).table.count()
        except:
            pass
        return count
    
    def yesterday(self):
        count = 0
        try:
            yesterday = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=1)))
            count = PostAnalytics.objects.get(created_date=yesterday, posts=self).table.count()
        except:
            pass
        return count

    def total(self):
        count = PostAnalytics.objects.annotate(table_count=Count('table')).filter(posts=self).aggregate(Sum('table_count'))
        if count['table_count__sum']:
            return count['table_count__sum']
        else:
            return 0
        
    def trendy(self):
        seven_days_ago = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=6)))
        today          = convert_to_localtime(timezone.make_aware(datetime.datetime.now()))
        counts = PostAnalytics.objects.filter(created_date__range=[seven_days_ago, today], posts=self).values_list('created_date', Count('table'))
        trendy = 0
        for count in counts:
            rate = -(1/7) * ((today.date()-count[0]).days) + 2
            trendy += count[1] * rate
        return trendy
    
    def tagging(self):
        return [tag for tag in self.tag.split(',') if tag]

    def get_thumbnail(self):
        if self.image:
            return settings.MEDIA_URL + str(self.image) + '.minify.' + str(self.image).split('.')[-1]
        else:
            return settings.STATIC_URL + '/images/default-post.png'
    
    def to_dict_for_analytics(self):
        return {
            'pk': self.pk,
            'author': self.author.username,
            'title': self.title,
            'data': self.created_date,
            'today': self.today(),
            'yesterday': self.yesterday(),
            'total': self.total(),
            'hide': self.hide,
            'total_comment': self.comments.count(),
            'total_likes': self.total_likes(),
            'tag': self.tag,
            'url': self.get_absolute_url(),
        }

    def save(self, *args, **kwargs):
        will_make_thumbnail = False
        if not self.pk and self.image:
            will_make_thumbnail = True
        try:
            this = Post.objects.get(id=self.id)
            if this.image != self.image:
                this.image.delete(save=False)
                will_make_thumbnail = True
        except:
            pass
        super(Post, self).save(*args, **kwargs)
        if will_make_thumbnail:
            make_thumbnail(self, size=750, save_as=True, quality=85)
            make_thumbnail(self, size=1920, quality=85)

class PostAnalytics(models.Model):
    posts        = models.ForeignKey(Post, on_delete=models.CASCADE)
    table        = models.ManyToManyField(History, related_name='thread_viewer', blank=True)
    created_date = models.DateField(default=timezone.now)

    def __str__(self):
        return self.posts.title

class PostLikes(models.Model):
    class Meta:
        db_table = 'board_post_likes'
        auto_created = True
    
    post         = models.ForeignKey(Post, on_delete=models.CASCADE)
    user         = models.ForeignKey(User, on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.post.title

class Comment(models.Model):
    author       = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post         = models.ForeignKey('board.Post', related_name='comments', on_delete = models.CASCADE)
    text_md      = models.TextField(max_length=300)
    text_html    = models.TextField()
    edited       = models.BooleanField(default=False)
    heart        = models.BooleanField(default=False)
    likes        = models.ManyToManyField(User, related_name='like_comments', blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.text_md
    
    def get_thumbnail(self):
        if self.image:
            return self.image.url
        else:
            return settings.STATIC_URL + '/images/default-post.png'
    
    def get_absolute_url(self):
        return self.post.get_absolute_url()
    
    def total_likes(self):
        return self.likes.count()

class Notify(models.Model):
    user         = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    url          = models.CharField(max_length=255)
    is_read      = models.BooleanField(default=False)
    infomation   = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.infomation

    def to_dict(self):
        return {
            'pk': self.pk,
            'user': self.user.username,
            'infomation': self.infomation,
            'created_date': timesince(self.created_date)
        }

class Series(models.Model):
    owner        = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name         = models.CharField(max_length=50, unique=True)
    text_md      = models.TextField(blank=True)
    text_html    = models.TextField(blank=True)
    hide         = models.BooleanField(default=False)
    url          = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    layout       = models.CharField(max_length=5, default='list')
    created_date = models.DateTimeField(default=timezone.now)

    def posts(self):
        posts = Post.objects.filter(series=self, hide=False)
        if self.layout == 'book':
            posts = posts.order_by('-created_date')
        else:
            posts = posts.order_by('created_date')
        
        return posts

    def total_posts(self):
        return Post.objects.filter(series=self, hide=False).count()

    def __str__(self):
        return self.name

    def thumbnail(self):
        posts = self.posts()
        if posts:
            return posts[0].get_thumbnail()
        else:
            return settings.STATIC_URL + '/images/default-post.png'
    
    def get_absolute_url(self):
        return reverse('series_list', args=[self.owner, self.url])

class Report(models.Model):
    user         = models.ForeignKey('board.history', on_delete=models.CASCADE)
    posts        = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    content      = models.TextField(blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return posts

class SearchValue(models.Model):
    value   = models.CharField(max_length=50, unique=True)
    
    def __str__(self):
        return value

class Search(models.Model):
    user         = models.ForeignKey('board.history', on_delete=models.CASCADE)
    search_value = models.ForeignKey('board.SearchValue', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return value

class RefererFrom(models.Model):
    location = models.CharField(max_length=500, unique=True)

    def __str__(self):
        return self.location

class Referer(models.Model):
    posts        = models.ForeignKey('board.PostAnalytics', related_name='referers', on_delete=models.CASCADE)
    referer_from = models.ForeignKey('board.RefererFrom', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.referer_from.location
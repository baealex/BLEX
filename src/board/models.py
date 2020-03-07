import requests
import datetime
import random

from django.db import models
from django.contrib.auth.models import User
from django.template.loader import render_to_string
from django.template.defaultfilters import linebreaks
from django.urls import reverse
from django.utils import timezone
from django.utils.html import escape
from django.utils.timesince import timesince
from tagging.fields import TagField

from PIL import Image

grade_mapping = {
    'blogger'     : 'blogger-gray',
    'contributor' : 'contributor-green',
    'supporter'   : 'supporter-orange',
    'sponsor'     : 'sponsor-ff69b4',
    'partner'     : 'partner-blueviolet',
    'master'      : 'master-purple'
}

def randstr(length):
    rstr = '0123456789abcdefghijklnmopqrstuvwxyzABCDEFGHIJKLNMOPQRSTUVWXYZ'
    rstr_len = len(rstr) - 1
    result = ''
    for i in range(length):
        result += rstr[random.randint(0, rstr_len)]
    return result

def parsedown(text):
    data = {'md': text.encode('utf-8')}
    res = requests.post('http://baealex.dothome.co.kr/api/parsedown/get.php', data=data)
    return res.text

def avatar_path(instance, filename):
    dt = datetime.datetime.now()
    return 'avatar/u/'+instance.user.username+ '/' + randstr(4) +'.'+filename.split('.')[-1]

def title_image_path(instance, filename):
    dt = datetime.datetime.now()
    return 'title/'+instance.author.username+'/'+str(dt.year)+'/'+str(dt.month)+'/'+str(dt.day)+'/'+str(dt.hour) + randstr(4)+'.'+filename.split('.')[-1]

def get_user_thumbnail(user):
    if user.profile.avatar:
        return user.profile.avatar.url
    else:
        return 'https://static.blex.kr/assets/images/default-avatar.jpg'

class History(models.Model):
    user         = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post         = models.ForeignKey('board.Post', on_delete = models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.user.username

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

    def __str__(self):
        return self.user.username

class Profile(models.Model):
    user       = models.OneToOneField(User, on_delete=models.CASCADE)
    subscriber = models.ManyToManyField(User, through='Follow', related_name='subscriber', blank=True)
    grade      = models.ForeignKey('board.Grade', on_delete=models.CASCADE, blank=True, null=True)
    exp        = models.IntegerField(default=0)
    bio        = models.TextField(max_length=500, blank=True)
    avatar     = models.ImageField(blank=True,upload_to=avatar_path)
    github     = models.CharField(max_length=15, blank=True)
    twitter    = models.CharField(max_length=15, blank=True)
    youtube    = models.CharField(max_length=30, blank=True)
    facebook   = models.CharField(max_length=30, blank=True)
    instagram  = models.CharField(max_length=15, blank=True)
    homepage   = models.CharField(max_length=100, blank=True)
    about_md   = models.TextField()
    about_html = models.TextField()

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
            image = Image.open(self.avatar)
            image.thumbnail((350, 350), Image.ANTIALIAS)
            image.save('static/' + str(self.avatar), quality=85)
    
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

class Thread(models.Model):
    author            = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title             = models.CharField(max_length=50)
    url               = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    image             = models.ImageField(blank=True, upload_to=title_image_path)
    trendy            = models.IntegerField(default=0)
    today             = models.IntegerField(default=0)
    yesterday         = models.IntegerField(default=0)
    total             = models.IntegerField(default=0)
    hide              = models.BooleanField(default=False)
    notice            = models.BooleanField(default=False)
    allow_write       = models.BooleanField(default=False)
    created_date      = models.DateTimeField(default=timezone.now)
    real_created_date = models.DateTimeField(default=timezone.now)
    tag               = TagField()
    bookmark          = models.ManyToManyField(User, related_name='thread_subscribe', blank=True)

    def total_bookmark(self):
        return self.bookmark.count()

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse('thread_detail', args=[self.url])

    def get_thumbnail(self):
        return str(self.image) + '_500.' + str(self.image).split('.')[-1]

    def save(self, *args, **kwargs):
        will_make_thumbnail = False
        if not self.pk and self.image:
            will_make_thumbnail = True
        try:
            this = Thread.objects.get(id=self.id)
            if this.image != self.image:
                this.image.delete(save=False)
                will_make_thumbnail = True
        except:
            pass
        super(Thread, self).save(*args, **kwargs)
        if will_make_thumbnail:
            image = Image.open(self.image)
            image.thumbnail((500, 500), Image.ANTIALIAS)
            image.save('static/' + self.get_thumbnail(), quality=85)

class Story(models.Model):
    class Meta:
        ordering = ['-created_date']
    
    thread       = models.ForeignKey('board.Thread', related_name='story', on_delete = models.CASCADE)
    author       = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title        = models.CharField(max_length=50)
    text_md      = models.TextField()
    text_html    = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)
    disagree     = models.ManyToManyField(User, related_name='story_disagree', blank=True)

    def __str__(self):
        return self.title

    def total_disagree(self):
        return self.disagree.count()

    def to_dict(self):
        return {
            'pk': self.pk,
            'title': self.title,
            'author': self.author.username,
            'content': self.text_html,
            'disagree': self.total_disagree(),
            'thumbnail': get_user_thumbnail(self.author),
            'created_date': self.created_date.strftime("%Y-%m-%d %H:%M"),
            'updated_date': self.updated_date.strftime("%Y-%m-%d %H:%M"),
        }

class Post(models.Model):
    author            = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title             = models.CharField(max_length=50)
    url               = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    image             = models.ImageField(blank=True, upload_to=title_image_path)
    text_md           = models.TextField(blank=True)
    text_html         = models.TextField()
    trendy            = models.IntegerField(default=0)
    today             = models.IntegerField(default=0)
    yesterday         = models.IntegerField(default=0)
    total             = models.IntegerField(default=0)
    hide              = models.BooleanField(default=False)
    notice            = models.BooleanField(default=False)
    block_comment     = models.BooleanField(default=False)
    likes             = models.ManyToManyField(User, through='PostLikes', related_name='likes', blank=True)
    tag               = TagField()
    created_date      = models.DateTimeField(default=timezone.now)
    updated_date      = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse('post_detail', args=[self.author, self.url])

    def total_likes(self):
        return self.likes.count()
    
    def get_thumbnail(self):
        return str(self.image) + '_500.' + str(self.image).split('.')[-1]

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
            image = Image.open(self.image)
            image.thumbnail((500, 500), Image.ANTIALIAS)
            image.save('static/' + self.get_thumbnail(), quality=85)

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
    text         = models.TextField(max_length=300)
    edit         = models.BooleanField(default=False)
    heart        = models.BooleanField(default=False)
    likes        = models.ManyToManyField(User, related_name='commentlist', blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.text
    
    def total_likes(self):
        return self.likes.count()
    
    def to_dict(self):
        return {
            'pk': self.pk,
            'author': self.author.username,
            'created_date': timesince(self.created_date),
            'content': linebreaks(escape(self.text)),
            'total_likes': self.total_likes(),
            'thumbnail': get_user_thumbnail(self.author),
            'edited': 'edited' if self.edit == True else '',
        }

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
            'infomation': self.infomation,
            'created_date': timesince(self.created_date)
        }

class Series(models.Model):
    owner        = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name         = models.CharField(max_length=50, unique=True)
    url          = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    posts        = models.ManyToManyField(Post, related_name='postlist', blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name
    
    def get_absolute_url(self):
        return reverse('series_list', args=[self.owner, self.url])
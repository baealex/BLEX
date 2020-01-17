import requests
import datetime
import random

from django.db import models
from django.contrib.auth.models import User
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone
from tagging.fields import TagField

font_mapping = {
    'Noto Sans'       : 'noto',
    'RIDIBatang'      : 'ridi',
    'Noto Sans Serif' : 'serif'
}

theme_mapping = {
    'Default'      : '',
    'Dark Mode'    : 'dark',
    'Violet'       : 'purple',
    'Green & Blue' : 'glue'
}

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

def create_notify(user, post, infomation):
    new_notify = Notify(user=user, post=post, infomation=infomation)
    new_notify.save()

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

class Font(models.Model):
    name = models.CharField(max_length=30, unique=True)

    def __str__(self):
        return self.name

class Theme(models.Model):
    color = models.CharField(max_length=30, unique=True)

    def __str__(self):
        return self.color

class Config(models.Model):
    user          = models.OneToOneField(User, on_delete=models.CASCADE)
    agree_email   = models.BooleanField(default=False)
    agree_history = models.BooleanField(default=False)
    post_fonts    = models.ForeignKey('board.Font', on_delete=models.CASCADE, blank=True, null=True)
    post_theme    = models.ForeignKey('board.Theme', on_delete=models.CASCADE, blank=True, null=True)

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
        try:
            this = Profile.objects.get(id=self.id)
            if this.avatar != self.avatar:
                this.avatar.delete(save=False)
        except:
            pass
        super(Profile, self).save(*args, **kwargs)

class Follow(models.Model):
    class Meta:
        db_table = 'board_user_follow'
        auto_created = True
    following    = models.ForeignKey(Profile, on_delete=models.CASCADE)
    follower     = models.ForeignKey(User, on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.post.title

class Post(models.Model):
    author        = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title         = models.CharField(max_length=50)
    url           = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    image         = models.ImageField(blank=True, upload_to=title_image_path)
    text_md       = models.TextField()
    text_html     = models.TextField()
    trendy        = models.IntegerField(default=0)
    today         = models.IntegerField(default=0)
    yesterday     = models.IntegerField(default=0)
    total         = models.IntegerField(default=0)
    hide          = models.BooleanField(default=False)
    notice        = models.BooleanField(default=False)
    block_comment = models.BooleanField(default=False)
    likes         = models.ManyToManyField(User, through='PostLikes', related_name='likes', blank=True)
    tag           = TagField()
    created_date  = models.DateTimeField(default=timezone.now)
    updated_date  = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse('post_detail', args=[self.author, self.url])

    def total_likes(self):
        return self.likes.count()

    def save(self, *args, **kwargs):
        try:
            this = Post.objects.get(id=self.id)
            if this.image != self.image:
                this.image.delete(save=False)
        except:
            pass
        super(Post, self).save(*args, **kwargs)

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

class Notify(models.Model):
    user         = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post         = models.ForeignKey(Post, on_delete=models.CASCADE)
    is_read      = models.BooleanField(default=False)
    infomation   = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.infomation

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
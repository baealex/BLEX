from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.urls import reverse
from tagging.fields import TagField
import requests
import datetime
import random
from django.template.loader import render_to_string

font_mapping = {
    'Noto Sans' : 'noto',
    'RIDIBatang' : 'ridi',
    'Noto Sans Serif' : 'serif'
}

theme_mapping = {
    'Default' : '',
    'Dark Mode' : 'dark',
    'Violet' : 'purple',
    'Green & Blue' : 'glue'
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

"""
class Team(models.Model):
    name = models.CharField(max_length=15, unique=True)
    owner = models.ForeignKey('auth.User')
    member = models.ManyToManyField(User, related_name='members', blank=True)
    bio = models.TextField(max_length=500, blank=True)
    about = models.TextField(blank=True)
    avatar = models.ImageField(blank=True, upload_to=team_logo_path)

class TeamPost(models.Model):
    pass

class TeamCategory(models.Model):
    pass
"""

"""
class Request(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post = models.ForeignKey('board.Post', on_delete = models.CASCADE)
    comment = models.ForeignKey('board.Comment', related_name='request', on_delete = models.CASCADE)
    content = models.TextField(blank=True)
    is_apply = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
"""

"""
class MiddleComment(models.Model):
    pass
"""

class History(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post = models.ForeignKey('board.Post', on_delete = models.CASCADE)
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
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    agree_email = models.BooleanField(default=False)
    agree_history = models.BooleanField(default=False)
    post_fonts = models.ForeignKey('board.Font', on_delete=models.CASCADE, blank=True, null=True)
    post_theme = models.ForeignKey('board.Theme', on_delete=models.CASCADE, blank=True, null=True)

    def __str__(self):
        return self.user.username

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    subscriber = models.ManyToManyField(User, through='Follow', related_name='subscriber', blank=True)
    grade = models.ForeignKey('board.Grade', on_delete=models.CASCADE, blank=True, null=True)
    exp = models.IntegerField(default=0)
    bio = models.TextField(max_length=500, blank=True)
    avatar = models.ImageField(blank=True,upload_to=avatar_path)
    github = models.CharField(max_length=15, blank=True)
    twitter = models.CharField(max_length=15, blank=True)
    youtube = models.CharField(max_length=30, blank=True)
    facebook = models.CharField(max_length=30, blank=True)
    instagram = models.CharField(max_length=15, blank=True)
    homepage = models.CharField(max_length=100, blank=True)

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
    following = models.ForeignKey(Profile, on_delete=models.CASCADE)
    follower = models.ForeignKey(User, on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.post.title

class Post(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title = models.CharField(max_length=50)
    url = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    image = models.ImageField(blank=True, upload_to=title_image_path)
    text_md = models.TextField()
    text_html = models.TextField()
    trendy = models.IntegerField(default=0)
    view_cnt = models.IntegerField(default=0)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)
    hide = models.BooleanField(default=False)
    notice = models.BooleanField(default=False)
    block_comment = models.BooleanField(default=False)
    likes = models.ManyToManyField(User, through='PostLikes', related_name='likes', blank=True)
    tag = TagField()
    
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
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.post.title

class Comment(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post = models.ForeignKey('board.Post', related_name='comments', on_delete = models.CASCADE)
    text = models.TextField(max_length=300)
    created_date = models.DateTimeField(default=timezone.now)
    edit = models.BooleanField(default=False)

    def __str__(self):
        return self.text

class Notify(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)
    infomation = models.TextField()
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return self.infomation

class Series(models.Model):
    owner = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name = models.CharField(max_length=50, unique=True)
    url = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    posts = models.ManyToManyField(Post, related_name='postlist', blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name
    
    def get_absolute_url(self):
        return reverse('series_list', args=[self.owner, self.url])
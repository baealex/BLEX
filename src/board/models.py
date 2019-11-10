from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.urls import reverse
from tagging.fields import TagField
import requests
import datetime
import random
from django.template.loader import render_to_string

def randstr(length):
    rstr = '0123456789abcdefghijklnmopqrstuvwxyzABCDEFGHIJKLNMOPQRSTUVWXYZ'
    rstr_len = len(rstr) - 1
    result = ''
    for i in range(length):
        result += rstr[random.randint(0, rstr_len)]
    return result

def parsedown(text):
    data = {'Text': text.encode('utf-8')}
    res = requests.post('https://baealex.run.goorm.io/api/parsedown/get.php', data=data)
    return res.text

def avatar_path(instance, filename):
    dt = datetime.datetime.now()
    return 'avatar/u/'+instance.user.username+ '/' + randstr(4) +'.'+filename.split('.')[-1]

def image_path(instance, filename):
    dt = datetime.datetime.now()
    return 'title/'+instance.author.username+'/'+str(dt.year)+'/'+str(dt.month)+'/'+str(dt.day)+'/'+str(dt.hour)+'_'+randstr(4)+'.'+filename.split('.')[-1]

def create_notify(target, url, content):
    new_notify = Notify(to_user=target, from_user=url, infomation=content)
    new_notify.save()

class History(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    post_pk = models.TextField(blank=True)

    def __str__(self):
        return self.user.username

class Config(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    agree_email = models.BooleanField(default=False)
    agree_history = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    subscriber = models.ManyToManyField(User, related_name='subscriber', blank=True)
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

    def save(self, *args, **kwargs):
        try:
            this = Profile.objects.get(id=self.id)
            if this.avatar != self.avatar:
                this.avatar.delete(save=False)
        except:
            pass
        super(Profile, self).save(*args, **kwargs)
    
class Post(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    url = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    title = models.CharField(max_length=50)
    text_md = models.TextField()
    text_html = models.TextField()
    trendy = models.IntegerField(default=0)
    view_cnt = models.IntegerField(default=0)
    hide = models.BooleanField(default=False)
    notice = models.BooleanField(default=False)
    search = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(blank=True, default=timezone.now)
    last_like_date = models.DateTimeField(blank=True, default=timezone.now)
    image = models.ImageField(blank=True, upload_to=image_path)
    likes = models.ManyToManyField(User, related_name='likes', blank=True)
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

class Comment(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post = models.ForeignKey('board.Post', related_name='comments', on_delete = models.CASCADE)
    text = models.TextField(max_length=300)
    created_date = models.DateTimeField(default=timezone.now)
    edit = models.BooleanField(default=False)

    def __str__(self):
        return self.text

class Notify(models.Model):
    to_user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    from_user = models.CharField(max_length=50)
    infomation = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.infomation

class Series(models.Model):
    owner = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name = models.CharField(max_length=50, unique=True)
    posts = models.ManyToManyField(Post, related_name='postlist', blank=True)

    def __str__(self):
        return self.name
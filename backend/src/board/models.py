import datetime

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Sum, Count
from django.template.defaultfilters import truncatewords
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from django.utils.html import strip_tags

from PIL import Image, ImageFilter

from board.modules.time import time_since, time_stamp
from modules.randomness import randstr


def calc_read_time(html):
    return int(len(strip_tags(html)) / 500)


def cover_path(instance, filename):
    return f"images/avatar/u/{instance.user.username}/c{randstr(4)}.{filename.split('.')[-1]}"


def avatar_path(instance, filename):
    return f"images/avatar/u/{instance.user.username}/a{randstr(4)}.{filename.split('.')[-1]}"


def create_description(text):
    return truncatewords(strip_tags(text), 50)


def title_image_path(instance, filename):
    dt = datetime.datetime.now()
    path = f"images/title/{dt.year}/{dt.month}/{dt.day}/{instance.author.username}"
    name = f"{dt.hour}_{randstr(8)}.{filename.split('.')[-1]}"
    return f"{path}/{name}"


def make_thumbnail(this, size, save_as=False, quality=100):
    if hasattr(this, 'avatar'):
        this.image = this.avatar

    image = Image.open(this.image)
    if not save_as:
        image.thumbnail((size, size), Image.ANTIALIAS)
        image.save(f'static/{this.image}', quality=quality)
        return

    image.thumbnail((size, size), Image.ANTIALIAS)
    image.save(f"static/{this.image}.minify.{str(this.image).split('.')[-1]}", quality=quality)


# Models

class Comment(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    post = models.ForeignKey('board.Post', related_name='comments', on_delete=models.CASCADE)
    text_md = models.TextField(max_length=500)
    text_html = models.TextField()
    edited = models.BooleanField(default=False)
    heart = models.BooleanField(default=False)
    likes = models.ManyToManyField(User, related_name='like_comments', blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def author_username(self):
        if not self.author:
            return 'Ghost'
        return self.author.username

    def author_thumbnail(self):
        if not self.author:
            return settings.STATIC_URL + '/images/ghost.png'
        return self.author.profile.get_thumbnail()

    def get_text_html(self):
        if not self.author:
            return '<p>삭제된 댓글입니다.</p>'
        return self.text_html

    def get_thumbnail(self):
        if self.image:
            return self.image.url
        else:
            return settings.STATIC_URL + '/images/default-post.png'

    def get_absolute_url(self):
        return self.post.get_absolute_url()

    def time_since(self):
        return time_since(self.created_date)

    def total_likes(self):
        return self.likes.count()

    def __str__(self):
        return self.text_md


class EmailChange(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    email = models.CharField(max_length=255)
    auth_token = models.CharField(max_length=8, blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def is_token_expire(self):
        seven_day_ago = timezone.now() - datetime.timedelta(days=7)
        if self.created_date < seven_day_ago:
            return True
        return False

    def __str__(self):
        return self.user.username


class UserConfigMeta(models.Model):
    user = models.ForeignKey(User, related_name='conf_meta', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    prop = {
        'AGREE_DISPLAY_EMAIL': {
            'name': 'AGREE_DISPLAY_EMAIL',
            'type': lambda x: True if x == 'true' else False,
        },
        'AGREE_SEND_EMAIL': {
            'name': 'AGREE_SEND_EMAIL',
            'type': lambda x: True if x == 'true' else False,
        }
    }
    props = prop.keys()

    def __str__(self):
        return f'{self.user.username} {self.name}'


class Config(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    def create_or_update_meta(self, name, value):
        if not name in UserConfigMeta.props:
            return None

        meta = UserConfigMeta.objects.filter(user=self.user, name=name)
        if meta.exists():
            meta = meta.first()

            if not meta.value == value:
                meta.value = value
                meta.save()
            return True

        UserConfigMeta(user=self.user, name=name, value=str(value)).save()
        return True

    def get_meta(self, name):
        if not name in UserConfigMeta.props:
            return None

        meta = UserConfigMeta.objects.filter(user=self.user, name=name)
        if not meta.exists():
            return None

        meta = meta.first()
        return UserConfigMeta.prop[name]['type'](meta.value)

    def has_telegram_id(self):
        if hasattr(self.user, 'telegramsync'):
            if not self.user.telegramsync.tid == '':
                return True
        return False

    def has_two_factor_auth(self):
        if hasattr(self.user, 'twofactorauth'):
            return True
        return False

    def __str__(self):
        return self.user.username


class Follow(models.Model):
    class Meta:
        db_table = 'board_user_follow'

    following = models.ForeignKey('board.Profile', related_name='subscriber', on_delete=models.CASCADE)
    follower = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return str(self.follower)


class Form(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title = models.CharField(max_length=50)
    content = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title


class History(models.Model):
    key = models.CharField(max_length=44, unique=True)
    ip = models.CharField(max_length=39)
    agent = models.CharField(max_length=200)
    category = models.CharField(max_length=15, blank=True)

    def __str__(self):
        return str(self.key)


class ImageCache(models.Model):
    key = models.CharField(max_length=44, unique=True)
    path = models.CharField(max_length=128, unique=True)
    size = models.IntegerField(default=0)

    def __str__(self):
        return self.path


class Notify(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    key = models.CharField(max_length=44, unique=True)
    url = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    infomation = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def to_dict(self):
        return {
            'pk': self.pk,
            'user': self.user.username,
            'infomation': self.infomation,
            'created_date': time_since(self.created_date)
        }

    def time_since(self):
        return time_since(self.created_date)

    def __str__(self):
        return str(self.user)


class Tag(models.Model):
    value = models.CharField(max_length=50)

    def __str__(self):
        return str(self.value)


class Post(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    series = models.ForeignKey('board.Series', related_name='posts', on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=50)
    url = models.SlugField(max_length=65, unique=True, allow_unicode=True)
    image = models.ImageField(blank=True, upload_to=title_image_path)
    read_time = models.IntegerField(default=0)
    tags = models.ManyToManyField(Tag, related_name='posts', blank=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def get_image(self):
        if self.image:
            return self.image.url
        else:
            return settings.STATIC_URL + 'images/default-post.png'

    def time_stamp(self):
        return time_stamp(self.created_date)

    def get_absolute_url(self):
        return reverse('post_detail', args=[self.author, self.url])

    def total_likes(self):
        return self.likes.count()

    def total_comment(self):
        return self.comments.count()

    def search_description(self, search_text, count=30):
        if not search_text:
            return self.description()

        text = strip_tags(self.content.text_html.lower())
        point = text.find(search_text)

        if point < 0:
            return self.description()

        description = text[point - 100:point] + text[point:point + 100]
        if point > 100:
            description = '...' + description

        return truncatewords(description, count)

    def description(self, count=25, document_for=''):
        desc = truncatewords(strip_tags(self.content.text_html), count)
        if document_for == 'seo':
            if not desc:
                return '이 포스트는 이미지 혹은 영상으로만 구성되어 있습니다.'
            return desc[:120]
        return desc

    def today(self):
        count = 0
        try:
            today = timezone.now()
            count = self.analytics.get(created_date=today).table.count()
        except:
            pass
        return count

    def yesterday(self):
        count = 0
        try:
            yesterday = timezone.now() - datetime.timedelta(days=1)
            count = self.analytics.get(created_date=yesterday).table.count()
        except:
            pass
        return count

    def total(self):
        count = PostAnalytics.objects.annotate(table_count=Count('table')).filter(posts=self).aggregate(
            Sum('table_count'))
        if count['table_count__sum']:
            return count['table_count__sum']
        else:
            return 0

    def trendy(self):
        today = timezone.now()
        seven_days_ago = timezone.now() - datetime.timedelta(days=7)
        counts = PostAnalytics.objects.filter(created_date__range=[seven_days_ago, today], posts=self).values_list(
            'created_date', Count('table'))
        trendy = 0
        for count in counts:
            rate = -(1 / 7) * ((today.date() - count[0]).days) + 2
            trendy += count[1] * rate
        return trendy

    def set_tags(self, tags: str):
        self.tags.clear()
        tags = tags.replace(',', '-').replace('_', '-')
        tags = slugify(tags, allow_unicode=True).split('-')

        if len(tags) == 1 and tags[0] == '':
            tags = ['미분류']

        for tag in set(tags):
            tag_object = Tag.objects.filter(value=tag)
            if not tag_object.exists():
                Tag(value=tag).save()
                tag_object = Tag.objects.filter(value=tag)
            self.tags.add(tag_object.first())

    def tagging(self):
        return [tag.value for tag in self.tags.all() if tag]

    def get_thumbnail(self):
        if self.image:
            return settings.MEDIA_URL + str(self.image)
        else:
            return settings.STATIC_URL + 'images/default-post.png'

    def __str__(self):
        return self.title

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


class PostContent(models.Model):
    posts = models.OneToOneField('board.Post', related_name='content', on_delete=models.CASCADE)
    text_md = models.TextField(blank=True)
    text_html = models.TextField(blank=True)

    def __str__(self):
        return self.posts.title


class PostConfig(models.Model):
    posts = models.OneToOneField('board.Post', related_name='config', on_delete=models.CASCADE)
    hide = models.BooleanField(default=False)
    notice = models.BooleanField(default=False)
    pinned = models.BooleanField(default=False)
    advertise = models.BooleanField(default=False)
    block_comment = models.BooleanField(default=False)

    def __str__(self):
        return self.posts.title


class PostConfigMeta(models.Model):
    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)


class PostAnalytics(models.Model):
    posts = models.ForeignKey('board.Post', related_name='analytics', on_delete=models.CASCADE)
    table = models.ManyToManyField('board.History', blank=True)
    created_date = models.DateField(default=timezone.now)

    def __str__(self):
        return str(self.posts)


class PostLikes(models.Model):
    class Meta:
        db_table = 'board_post_likes'

    post = models.ForeignKey('board.Post', related_name='likes', on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return str(self.post)


class PostThanks(models.Model):
    post = models.ForeignKey('board.Post', related_name='thanks', on_delete=models.CASCADE)
    history = models.ForeignKey('board.History', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return str(self.post)


class PostNoThanks(models.Model):
    post = models.ForeignKey('board.Post', related_name='nothanks', on_delete=models.CASCADE)
    history = models.ForeignKey('board.History', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return str(self.post)


class UserProfileLayout(models.Model):
    order = models.IntegerField(default=0)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)


class UserLinkMeta(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)


class Profile(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    bio = models.TextField(max_length=500, blank=True)
    cover = models.ImageField(blank=True, upload_to=cover_path)
    avatar = models.ImageField(blank=True, upload_to=avatar_path)
    homepage = models.CharField(max_length=100, blank=True)
    github = models.CharField(max_length=15, blank=True)  # deprecated
    twitter = models.CharField(max_length=15, blank=True)  # deprecated
    youtube = models.CharField(max_length=30, blank=True)  # deprecated
    facebook = models.CharField(max_length=30, blank=True)  # deprecated
    instagram = models.CharField(max_length=15, blank=True)  # deprecated
    socials = models.TextField(blank=True)  # deprecated
    about_md = models.TextField(blank=True)  # deprecated
    about_html = models.TextField(blank=True)  # deprecated

    def collect_social(self):
        result = dict()
        for social in ['homepage', 'github', 'twitter', 'youtube', 'facebook', 'instagram']:
            if getattr(self, social):
                result[social] = getattr(self, social)
        return result

    def get_thumbnail(self):
        if self.avatar:
            return self.avatar.url
        else:
            return settings.STATIC_URL + 'images/default-avatar.jpg'

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

    def __str__(self):
        return self.user.username


class Referer(models.Model):
    posts = models.ForeignKey('board.PostAnalytics', on_delete=models.CASCADE)
    referer_from = models.ForeignKey('board.RefererFrom', related_name='referers', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.referer_from.location


class RefererFrom(models.Model):
    location = models.CharField(max_length=500, unique=True)
    title = models.CharField(max_length=100, default='', blank=True)
    image = models.CharField(max_length=500, default='', blank=True)
    description = models.CharField(max_length=250, default='', blank=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def should_update(self):
        created_date = self.created_date.strftime('%x%X')
        updated_date = self.updated_date.strftime('%x%X')
        if created_date == updated_date:
            return True

        three_month_ago = timezone.now() - datetime.timedelta(days=180)
        if self.updated_date < three_month_ago:
            return True

        return False

    def update(self):
        self.updated_date = timezone.now() + datetime.timedelta(minutes=1)
        self.save()

    def __str__(self):
        return self.location


class Report(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    reporter = models.ForeignKey('board.history', on_delete=models.CASCADE)
    posts = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    content = models.TextField(blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.posts.title


class Search(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    searcher = models.ForeignKey('board.history', on_delete=models.CASCADE)
    search_value = models.ForeignKey('board.SearchValue', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.search_value.value


class SearchValue(models.Model):
    value = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.value


class Series(models.Model):
    order = models.IntegerField(default=0)
    owner = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    text_md = models.TextField(blank=True)
    text_html = models.TextField(blank=True)
    hide = models.BooleanField(default=False)
    url = models.SlugField(max_length=50, unique=True, allow_unicode=True)
    layout = models.CharField(max_length=5, default='list')
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def thumbnail(self):
        posts = Post.objects.filter(series=self, config__hide=False)
        if posts:
            return posts[0].get_thumbnail()
        else:
            return settings.STATIC_URL + '/images/default-post.png'

    def get_absolute_url(self):
        return reverse('series_list', args=[self.owner, self.url])

    def __str__(self):
        return self.name


class SeriesConfigMeta(models.Model):
    post = models.ForeignKey('board.Series', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)


class TelegramSync(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    tid = models.CharField(max_length=15, blank=True)
    auth_token = models.CharField(max_length=8, blank=True)
    auth_token_exp = models.DateTimeField(default=timezone.now)
    created_date = models.DateTimeField(default=timezone.now)

    def is_token_expire(self):
        one_day_ago = timezone.now() - datetime.timedelta(days=1)
        if self.created_date < one_day_ago:
            return True
        return False

    def __str__(self):
        return self.user.username


class TempPosts(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title = models.CharField(max_length=50)
    token = models.CharField(max_length=50)
    text_md = models.TextField(blank=True)
    tag = models.CharField(max_length=50)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def time_since(self):
        return time_since(self.created_date)

    def __str__(self):
        return self.title


class TwoFactorAuth(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    recovery_key = models.CharField(max_length=45, blank=True)
    one_pass_token = models.CharField(max_length=15, blank=True)
    one_pass_token_exp = models.DateTimeField(default=timezone.now)
    created_date = models.DateTimeField(default=timezone.now)

    def create_token(self, token):
        self.one_pass_token = token
        self.one_pass_token_exp = timezone.now()
        self.save()

    def is_token_expire(self):
        five_minute_ago = timezone.now() - datetime.timedelta(minutes=5)
        if self.one_pass_token_exp < five_minute_ago:
            return True
        return False

    def has_been_a_day(self):
        one_day_ago = timezone.now() - datetime.timedelta(days=1)
        if self.created_date < one_day_ago:
            return True
        return False

    def __str__(self):
        return self.user.username


class EditHistory(models.Model):
    posts = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    title = models.CharField(max_length=50, default='_NO_CHANGED_')
    content = models.TextField(blank=True, default='_NO_CHANGED_')
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.posts


class EditRequest(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    posts = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    title = models.CharField(max_length=50, default='_NO_CHANGED_')
    content = models.TextField(blank=True, default='_NO_CHANGED_')
    is_merged = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title


class DeveloperToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=50, blank=True)
    token = models.CharField(max_length=50, blank=True)
    is_deleted = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title


class DeveloperTokenLog(models.Model):
    developer = models.ForeignKey('board.DeveloperToken', on_delete=models.CASCADE)
    history = models.ForeignKey('board.History', on_delete=models.CASCADE)
    url = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)

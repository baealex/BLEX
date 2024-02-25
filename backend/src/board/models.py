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

from modules.cipher import encrypt_value, decrypt_value
from modules.hash import get_sha256
from modules.randomness import randstr
from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot
from board.constants.config_meta import CONFIG_TYPE, CONFIG_TYPES, CONFIG_MAP
from board.modules.time import time_since, time_stamp


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


def make_thumbnail(instance, size, quality=100, type='normal'):
    if hasattr(instance, 'avatar'):
        instance.image = instance.avatar
    image = Image.open(instance.image)

    if type == 'preview':
        convert_image = image.convert('RGB')
        preview_image = convert_image.filter(ImageFilter.GaussianBlur(50))
        preview_image.save(
            f"static/{instance.image}.preview.jpg", quality=quality)
        return
    
    if type == 'minify':
        image.thumbnail((size, size), Image.LANCZOS)
        image.save(
            f"static/{instance.image}.minify.{str(instance.image).split('.')[-1]}", quality=quality)
    
    image.thumbnail((size, size), Image.LANCZOS)
    image.save(f'static/{instance.image}', quality=quality)
    return


# Models

class Comment(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    post = models.ForeignKey('board.Post', related_name='comments', on_delete=models.CASCADE)
    text_md = models.TextField(max_length=500)
    text_html = models.TextField()
    edited = models.BooleanField(default=False)
    heart = models.BooleanField(default=False)
    likes = models.ManyToManyField('auth.User', related_name='like_comments', blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def author_username(self):
        if not self.author:
            return 'Ghost'
        return self.author.username

    def author_thumbnail(self):
        if not self.author:
            return settings.STATIC_URL + 'images/ghost.jpg'
        return self.author.profile.get_thumbnail()

    def get_text_html(self):
        if not self.author:
            return '<p>삭제된 댓글입니다.</p>'
        return self.text_html

    def get_thumbnail(self):
        if self.image:
            return self.image.url
        else:
            return settings.STATIC_URL + 'images/default-post.png'

    def get_absolute_url(self):
        return self.post.get_absolute_url()

    def time_since(self):
        return time_since(self.created_date)

    def is_deleted(self):
        return self.author is None

    def __str__(self):
        return self.text_md


class EmailChange(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
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
    user = models.ForeignKey('auth.User', related_name='conf_meta', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.user.username


class Config(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)

    def create_or_update_meta(self, config: CONFIG_TYPE, value):
        if not config.value in CONFIG_TYPES:
            return None

        meta = UserConfigMeta.objects.filter(user=self.user, name=config.value)
        if meta.exists():
            meta = meta.first()

            if not meta.value == value:
                meta.value = value
                meta.save()
            return True

        UserConfigMeta(user=self.user, name=config.value, value=str(value)).save()
        return True

    def get_meta(self, config: CONFIG_TYPE):
        if not config.value in CONFIG_TYPES:
            return None

        meta = UserConfigMeta.objects.filter(user=self.user, name=config.value)
        if not meta.exists():
            return None

        meta = meta.first()
        return CONFIG_MAP[meta.name]['type'](meta.value)

    def has_telegram_id(self):
        if hasattr(self.user, 'telegramsync'):
            if not self.user.telegramsync.tid == '':
                return True
        return False

    def has_two_factor_auth(self):
        if hasattr(self.user, 'twofactorauth'):
            return True
        return False

    def has_openai_key(self):
        if hasattr(self.user, 'openaiconnection'):
            return True
        return False

    def __str__(self):
        return self.user.username


class Follow(models.Model):
    class Meta:
        db_table = 'board_user_follow'

    following = models.ForeignKey('board.Profile', related_name='subscriber', on_delete=models.CASCADE) # TODO: Change filed name to 'to'
    follower = models.ForeignKey('auth.User', on_delete=models.CASCADE) # TODO: Change filed name to 'from'
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


class Device(models.Model):
    key = models.CharField(max_length=44, unique=True)
    ip = models.CharField(max_length=39)
    agent = models.CharField(max_length=200)
    category = models.CharField(max_length=15, blank=True)

    def __str__(self):
        return str(self.key)


class ImageCache(models.Model):
    user = models.ForeignKey('auth.User', null=True, on_delete=models.SET_NULL)
    key = models.CharField(max_length=44, unique=True)
    path = models.CharField(max_length=128, unique=True)
    size = models.IntegerField(default=0)

    def __str__(self):
        return self.path


class Notify(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    key = models.CharField(max_length=44, unique=True)
    url = models.CharField(max_length=255)
    content = models.TextField()
    has_read = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    @staticmethod
    def create_hash_key(user: User, url: str, content: str, hidden_key: str = None):
        return get_sha256(user.username + url + content + (hidden_key if hidden_key else ''))

    def send_notify(self):
        if hasattr(self.user, 'telegramsync'):
            tid = self.user.telegramsync.get_decrypted_tid()
            if not tid == '':
                bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
                SubTaskProcessor.process(lambda: bot.send_messages(tid, [
                    settings.SITE_URL + str(self.url),
                    self.content
                ]))

    def to_dict(self):
        return {
            'id': self.id,
            'user': self.user.username,
            'content': self.content,
            'created_date': time_since(self.created_date)
        }

    def time_since(self):
        return time_since(self.created_date)

    def __str__(self):
        return str(self.user)


class Tag(models.Model):
    value = models.CharField(max_length=50)

    def get_image(self):
        post = self.posts.filter(
            config__hide=False,
            tags__value=self.value,
            image__contains='images'
        ).order_by('-created_date')

        if post.exists():
            return post.first().image.url
        return ''

    def __str__(self):
        return str(self.value)


class Post(models.Model):
    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    series = models.ForeignKey('board.Series', related_name='posts', on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=65)
    url = models.SlugField(max_length=65, unique=True, allow_unicode=True)
    image = models.ImageField(blank=True, upload_to=title_image_path)
    read_time = models.IntegerField(default=0)
    tags = models.ManyToManyField(Tag, related_name='posts', blank=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)
    meta_description = models.CharField(max_length=250, blank=True)

    def create_unique_url(self, url=None):
        url = url if url else slugify(self.title, allow_unicode=True)

        post = Post.objects.filter(url=url)
        while post.exists():
            url = url + '-' + randstr(8)
            post = Post.objects.filter(url=url)

        self.url = url

    def get_image(self):
        if self.image:
            return self.image.url
        else:
            return settings.STATIC_URL + 'images/default-post.png'

    def is_published(self):
        return self.created_date < timezone.now()

    def time_stamp(self):
        return time_stamp(self.created_date)

    def get_absolute_url(self):
        return reverse('post_detail', args=[self.author, self.url])

    def today(self):
        count = 0
        try:
            today = timezone.now()
            count = self.analytics.get(created_date=today).devices.count()
        except:
            pass
        return count

    def yesterday(self):
        count = 0
        try:
            yesterday = timezone.now() - datetime.timedelta(days=1)
            count = self.analytics.get(created_date=yesterday).devices.count()
        except:
            pass
        return count

    def total(self):
        count = PostAnalytics.objects.annotate(device_count=Count('devices')).filter(post=self).aggregate(
            Sum('device_count'))
        if count['device_count__sum']:
            return count['device_count__sum']
        else:
            return 0

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
        return self.image.url if self.image else ''

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        will_make_thumbnail = False
        if not self.pk and self.image:
            will_make_thumbnail = True

        post = Post.objects.filter(id=self.id)
        if post.exists():
            post = post.first()
            if post.image != self.image:
                will_make_thumbnail = True

        super(Post, self).save(*args, **kwargs)
        if will_make_thumbnail:
            make_thumbnail(self, size=750, quality=50, type='preview')
            make_thumbnail(self, size=750, quality=85, type='minify')
            make_thumbnail(self, size=1920, quality=85)


class PostContent(models.Model):
    post = models.OneToOneField('board.Post', related_name='content', on_delete=models.CASCADE)
    text_md = models.TextField(blank=True)
    text_html = models.TextField(blank=True)

    def __str__(self):
        return self.post.title


class PostConfig(models.Model):
    post = models.OneToOneField('board.Post', related_name='config', on_delete=models.CASCADE)
    hide = models.BooleanField(default=False)
    notice = models.BooleanField(default=False)
    pinned = models.BooleanField(default=False)
    advertise = models.BooleanField(default=False)
    block_comment = models.BooleanField(default=False)

    def __str__(self):
        return self.post.title


class PostConfigMeta(models.Model):
    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)


class PostAnalytics(models.Model):
    post = models.ForeignKey('board.Post', related_name='analytics', on_delete=models.CASCADE)
    devices = models.ManyToManyField('board.Device', blank=True)
    created_date = models.DateField(default=timezone.now)

    def __str__(self):
        return str(self.post)


class PostLikes(models.Model):
    class Meta:
        db_table = 'board_post_likes'

    post = models.ForeignKey('board.Post', related_name='likes', on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return str(self.post)


class PostThanks(models.Model):
    post = models.ForeignKey('board.Post', related_name='thanks', on_delete=models.CASCADE)
    device = models.ForeignKey('board.Device', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return str(self.post)


class PostNoThanks(models.Model):
    post = models.ForeignKey('board.Post', related_name='nothanks', on_delete=models.CASCADE)
    device = models.ForeignKey('board.Device', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return str(self.post)


class UserLinkMeta(models.Model):
    order = models.IntegerField(default=0)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.user.username


class Profile(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    bio = models.TextField(max_length=500, blank=True)
    cover = models.ImageField(blank=True, upload_to=cover_path)
    avatar = models.ImageField(blank=True, upload_to=avatar_path)
    homepage = models.CharField(max_length=100, blank=True)
    about_md = models.TextField(blank=True)
    about_html = models.TextField(blank=True)

    def collect_social(self):
        socials = []
        for meta in UserLinkMeta.objects.filter(user=self.user).order_by('order'):
            socials.append({
                'id': meta.id,
                'name': meta.name,
                'value': meta.value,
                'order': meta.order
            })
        return socials

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

        profile = Profile.objects.filter(id=self.id)
        if profile.exists():
            profile = profile.first()
            if profile.avatar != self.avatar:
                will_make_thumbnail = True

        super(Profile, self).save(*args, **kwargs)
        if will_make_thumbnail:
            make_thumbnail(self, size=500)

    def get_absolute_url(self):
        return reverse('user_profile', args=[self.user])

    def __str__(self):
        return self.user.username


class Referer(models.Model):
    post = models.ForeignKey('board.Post', on_delete=models.SET_NULL, null=True) # TODO: SET_NULL -> CASCADE
    analytics = models.ForeignKey('board.PostAnalytics', on_delete=models.CASCADE)
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
        six_month_ago = timezone.now() - datetime.timedelta(days=180)
        if self.updated_date < six_month_ago:
            return True

        if self.title and self.image and self.description:
            return False
        
        return True

    def save(self, *args, **kwargs):
        self.updated_date = timezone.now()
        super(RefererFrom, self).save(*args, **kwargs)

    def __str__(self):
        return self.title if self.title else self.location


class Report(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    device = models.ForeignKey('board.Device', on_delete=models.CASCADE)
    content = models.TextField(blank=True)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.post.title


class Search(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    device = models.ForeignKey('board.Device', on_delete=models.CASCADE)
    search_value = models.ForeignKey('board.SearchValue', related_name='searches', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.search_value.value


class SearchValue(models.Model):
    value = models.CharField(max_length=50, unique=True)
    reference_count = models.IntegerField(default=0)

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

    def create_unique_url(self, url=None):
        url = url if url else slugify(self.name, allow_unicode=True)

        series = Series.objects.filter(url=url)
        while series.exists():
            url = url + '-' + randstr(8)
            series = Series.objects.filter(url=url)

        self.url = url

    def thumbnail(self):
        posts = Post.objects.filter(series=self, config__hide=False)
        return posts[0].get_thumbnail() if posts else ''

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
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    tid = models.CharField(max_length=200, blank=True) # encrypted
    auth_token = models.CharField(max_length=8, blank=True)
    auth_token_exp = models.DateTimeField(default=timezone.now)
    created_date = models.DateTimeField(default=timezone.now)

    def get_decrypted_tid(self):
        return decrypt_value(self.tid)

    def is_token_expire(self):
        one_day_ago = timezone.now() - datetime.timedelta(days=1)
        if self.created_date < one_day_ago:
            return True
        return False

    def __str__(self):
        return self.user.username
    
    def save(self, *args, **kwargs):
        self.tid = encrypt_value(self.tid).decode()
        super().save(*args, **kwargs)


class OpenAIConnection(models.Model):
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE)
    api_key = models.CharField(max_length=200, blank=True) # encrypted
    created_date = models.DateTimeField(default=timezone.now)

    def get_decrypted_api_key(self):
        return decrypt_value(self.api_key)

    def __str__(self):
        return self.user.username

    def save(self, *args, **kwargs):
        self.api_key = encrypt_value(self.api_key).decode()
        super().save(*args, **kwargs)


class OpenAIUsageHistory(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    query = models.TextField()
    response = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)

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
    otp = models.CharField(max_length=15, blank=True)
    otp_exp_date = models.DateTimeField(default=timezone.now)
    created_date = models.DateTimeField(default=timezone.now)

    def create_token(self, token):
        self.otp = token
        self.otp_exp_date = timezone.now()
        self.save()

    def is_token_expire(self):
        five_minute_ago = timezone.now() - datetime.timedelta(minutes=5)
        if self.otp_exp_date < five_minute_ago:
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
    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    title = models.CharField(max_length=50, default='_NO_CHANGED_')
    content = models.TextField(blank=True, default='_NO_CHANGED_')
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.posts


class EditRequest(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    title = models.CharField(max_length=50, default='_NO_CHANGED_')
    content = models.TextField(blank=True, default='_NO_CHANGED_')
    is_merged = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title


class DeveloperToken(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    name = models.CharField(max_length=50, blank=True)
    token = models.CharField(max_length=50, blank=True)
    is_deleted = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.user


class DeveloperRequestLog(models.Model):
    developer = models.ForeignKey('board.DeveloperToken', on_delete=models.CASCADE)
    device = models.ForeignKey('board.Device', on_delete=models.CASCADE)
    endpoint = models.CharField(max_length=255)
    headers = models.TextField(blank=True)
    payload = models.TextField(blank=True)
    created_date = models.DateTimeField(default=timezone.now)


class UsernameChangeLog(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    username = models.CharField(max_length=50)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.username} -> {self.user.username}'


class SocialAuthProvider(models.Model):
    key = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=20)
    icon = models.CharField(max_length=20)
    color = models.CharField(max_length=20)

    def __str__(self):
        return self.name


class SocialAuth(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    provider = models.ForeignKey('board.SocialAuthProvider', on_delete=models.CASCADE)
    uid = models.CharField(max_length=50)
    extra_data = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.provider.name} - {self.user.username}'


class Invitation(models.Model):
    sender = models.ForeignKey('auth.User', related_name='invitations_sent', null=True, on_delete=models.SET_NULL)
    receiver = models.ForeignKey('auth.User', related_name='invitations_received', null=True, blank=True, on_delete=models.SET_NULL)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.sender.username} -> {self.receiver.username if self.receiver else "None"}'


class InvitationRequest(models.Model):
    sender = models.ForeignKey('auth.User', related_name='invitation_requests_sent', null=True, on_delete=models.SET_NULL)
    receiver = models.ForeignKey('auth.User', related_name='invitation_requests_received', null=True, on_delete=models.SET_NULL)
    content = models.TextField()
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f'{self.sender.username} -> {self.receiver.username}'

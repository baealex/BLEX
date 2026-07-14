import hashlib

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify

from modules.randomness import randstr

from board.modules.time import time_since, time_stamp
from board.services.post_content_service import PostContentService
from board.services.post_thumbnail_service import PostThumbnailService
from board.services.series_save_service import SeriesSaveService

from .helpers import title_image_path


class Comment(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['post', 'parent', 'created_date']),
            models.Index(fields=['author', 'created_date']),
        ]

    author = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)
    post = models.ForeignKey('board.Post', related_name='comments', on_delete=models.CASCADE)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
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

    def get_text_html(self):
        if not self.author:
            return '<p>삭제된 댓글입니다.</p>'
        return self.text_html

    def get_thumbnail(self):
        if self.image:
            return self.image.url
        return None

    def get_absolute_url(self):
        return self.post.get_absolute_url()

    def time_since(self):
        return time_since(self.created_date)

    def is_deleted(self):
        return self.author is None

    def is_reply(self):
        return self.parent is not None

    def get_replies(self):
        return self.replies.all().order_by('created_date')

    def clean(self):
        from django.core.exceptions import ValidationError
        # 1레벨 제한: 대댓글의 대댓글 방지
        if self.parent and self.parent.parent:
            raise ValidationError('대댓글에는 답글을 달 수 없습니다.')

    def __str__(self):
        return self.text_md


class Form(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    title = models.CharField(max_length=50)
    content = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title


class ImageCache(models.Model):
    user = models.ForeignKey('auth.User', null=True, on_delete=models.SET_NULL)
    key = models.CharField(max_length=44, unique=True)
    path = models.CharField(max_length=128, unique=True)
    size = models.IntegerField(default=0)

    def __str__(self):
        return self.path


class Tag(models.Model):
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['value'],
                name='board_tag_value_uniq',
            ),
        ]

    value = models.CharField(max_length=50)

    def get_image(self):
        post = self.posts.filter(
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
            tags__value=self.value,
            image__contains='images'
        ).order_by('-created_date').first()

        return post.image.url if post else ''

    def __str__(self):
        return str(self.value)


class ActivePostManager(models.Manager):
    """Keep recoverable deletions out of existing post query surfaces."""

    def get_queryset(self) -> models.QuerySet:
        return super().get_queryset().filter(deleted_date__isnull=True)


class Post(models.Model):
    DEFAULT_COVER_COUNT = 6

    objects = ActivePostManager()
    all_objects = models.Manager()

    class Meta:
        indexes = [
            models.Index(fields=['author', 'created_date']),
            models.Index(fields=['created_date']),
            models.Index(fields=['url']),
            models.Index(fields=['published_date']),
            models.Index(fields=['author', 'published_date']),
        ]

    author = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    series = models.ForeignKey('board.Series', related_name='posts', on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=65)
    subtitle = models.CharField(max_length=120, blank=True, default='')
    url = models.SlugField(max_length=65, unique=True, allow_unicode=True)
    image = models.ImageField(blank=True, upload_to=title_image_path)
    image_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)
    read_time = models.IntegerField(default=0)
    tags = models.ManyToManyField(Tag, related_name='posts', blank=True)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)
    published_date = models.DateTimeField(null=True, blank=True)
    deleted_date = models.DateTimeField(null=True, blank=True, db_index=True)
    meta_description = models.CharField(max_length=250, blank=True)

    def create_unique_url(self, url=None):
        url = url if url else slugify(self.title, allow_unicode=True)

        post = Post.all_objects.filter(url=url)
        if self.pk:
            post = post.exclude(pk=self.pk)

        while post.exists():
            url = url + '-' + randstr(8)
            post = Post.all_objects.filter(url=url)
            if self.pk:
                post = post.exclude(pk=self.pk)

        self.url = url

    def get_default_cover_index(self):
        seed = self.url or str(self.pk or self.title)
        digest = hashlib.md5(seed.encode()).hexdigest()
        return int(digest[:8], 16) % self.DEFAULT_COVER_COUNT + 1

    def get_default_cover_path(self):
        return f'assets/images/default-cover-{self.get_default_cover_index()}.jpg'

    def get_default_cover_url(self):
        return settings.RESOURCE_URL + self.get_default_cover_path()

    def get_image(self):
        if self.image:
            return self.image.url
        return self.get_default_cover_url()

    def is_published(self):
        from board.services.post_status_service import PostStatusService
        return PostStatusService.is_published(self)

    def is_draft(self):
        from board.services.post_status_service import PostStatusService
        return PostStatusService.is_draft(self)

    def time_stamp(self):
        return time_stamp(self.created_date)

    def get_absolute_url(self):
        return reverse('post_detail', args=[self.author.username, self.url])

    def time_since(self):
        return time_since(self.created_date)

    def tagging(self):
        return [tag.value for tag in self.tags.all() if tag]

    def get_thumbnail(self):
        if self.image:
            return self.image.url
        return None

    def get_minify_image(self):
        if self.image:
            try:
                ext = self.image.name.split('.')[-1]
                return f"{self.image.url}.minify.{ext}"
            except:
                return self.image.url
        return self.get_image()

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        will_make_thumbnail = PostThumbnailService.should_generate(self)
        super(Post, self).save(*args, **kwargs)
        if will_make_thumbnail:
            PostThumbnailService.generate_thumbnail_set(self)


class PostContent(models.Model):
    post = models.OneToOneField('board.Post', related_name='content', on_delete=models.CASCADE)
    content_html = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if self.post and not getattr(self, '_skip_read_time_sync', False):
            PostContentService.sync_parent_read_time(self.post, self.content_html)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.post.title


class PostConfig(models.Model):
    class CoverLayout(models.TextChoices):
        DEFAULT = 'default', '기본'
        SPLIT = 'split', '분할'
        OVERLAY = 'overlay', '이미지 배경'
        NONE = 'none', '커버 숨김'

    class CoverImagePosition(models.TextChoices):
        RIGHT = 'right', '오른쪽'
        LEFT = 'left', '왼쪽'

    class CoverImageRatio(models.TextChoices):
        AUTO = 'auto', '원본'
        WIDE = '16:9', '16:9'
        STANDARD = '4:3', '4:3'
        SQUARE = '1:1', '1:1'
        PORTRAIT = '3:4', '3:4'

    post = models.OneToOneField('board.Post', related_name='config', on_delete=models.CASCADE)
    hide = models.BooleanField(default=False)
    advertise = models.BooleanField(default=False)
    block_comment = models.BooleanField(default=False)
    cover_layout = models.CharField(
        max_length=16,
        choices=CoverLayout.choices,
        default=CoverLayout.DEFAULT,
    )
    cover_image_position = models.CharField(
        max_length=8,
        choices=CoverImagePosition.choices,
        default=CoverImagePosition.RIGHT,
    )
    cover_image_ratio = models.CharField(
        max_length=8,
        choices=CoverImageRatio.choices,
        default=CoverImageRatio.AUTO,
    )

    def __str__(self):
        return self.post.title


class PostConfigMeta(models.Model):
    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)


class PinnedPost(models.Model):
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'post'],
                name='board_pinned_user_post_uniq',
            ),
        ]

    post = models.ForeignKey('board.Post', related_name='pinned', on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    order = models.IntegerField(default=0)
    created_date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return str(self.post)


class PostLikes(models.Model):
    class Meta:
        db_table = 'board_post_likes'
        constraints = [
            models.UniqueConstraint(
                fields=['post', 'user'],
                name='board_postlike_post_user_uniq',
            ),
        ]
        indexes = [
            models.Index(fields=['post', 'user']),
            models.Index(fields=['user', 'created_date']),
        ]

    post = models.ForeignKey('board.Post', related_name='likes', on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    created_date = models.DateTimeField(default=timezone.now)

    def time_since(self):
        return time_since(self.created_date)

    def __str__(self):
        return str(self.post)


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
        SeriesSaveService.create_unique_url(self, url)

    def thumbnail(self):
        post = Post.objects.filter(
            series=self,
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
        ).first()
        return post.get_thumbnail() if post else ''

    def get_absolute_url(self):
        return reverse('series_detail', args=[self.owner.username, self.url])

    def time_since(self):
        return time_since(self.created_date)

    def save(self, *args, **kwargs):
        SeriesSaveService.prepare_for_save(self)
        super(Series, self).save(*args, **kwargs)

    def __str__(self):
        return self.name


class SeriesConfigMeta(models.Model):
    post = models.ForeignKey('board.Series', on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    value = models.CharField(max_length=255)
    created_date = models.DateTimeField(default=timezone.now)
    updated_date = models.DateTimeField(default=timezone.now)


class EditHistory(models.Model):
    class ChangeType(models.TextChoices):
        EDIT = 'edit', '수정 전'
        RESTORE = 'restore', '복원 전'
        LEGACY = 'legacy', '레거시'

    post = models.ForeignKey('board.Post', on_delete=models.CASCADE)
    actor = models.ForeignKey(
        'auth.User',
        related_name='post_edit_histories',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    restored_from = models.ForeignKey(
        'self',
        related_name='restore_events',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=65, default='_NO_CHANGED_')
    subtitle = models.CharField(max_length=120, blank=True, default='')
    content = models.TextField(blank=True, default='_NO_CHANGED_')
    description = models.CharField(max_length=250, blank=True, default='')
    tags = models.JSONField(default=list, blank=True)
    source_updated_date = models.DateTimeField(null=True, blank=True)
    change_type = models.CharField(
        max_length=16,
        choices=ChangeType.choices,
        default=ChangeType.LEGACY,
    )
    created_date = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=['post', 'created_date']),
        ]

    def __str__(self):
        return f'{self.post} · {self.created_date:%Y-%m-%d %H:%M}'


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

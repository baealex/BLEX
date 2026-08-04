from typing import Any, Literal

from django.utils.translation import gettext_lazy as _
from ninja import Field, Schema

CoverLayout = Literal['default', 'split', 'overlay', 'none']
CoverImagePosition = Literal['left', 'right']
CoverImageRatio = Literal['auto', '16:9', '4:3', '1:1', '3:4']


class DeveloperError(Schema):
    code: str
    message: str
    fields: dict[str, Any] | None = None


class DeveloperErrorEnvelope(Schema):
    error: DeveloperError


class DeveloperTokenInfo(Schema):
    id: int
    name: str
    token_prefix: str
    scopes: list[str]


class DeveloperUserInfo(Schema):
    id: int
    username: str
    name: str
    email: str
    is_editor: bool


class DeveloperMeData(Schema):
    user: DeveloperUserInfo
    token: DeveloperTokenInfo


class DeveloperMeEnvelope(Schema):
    data: DeveloperMeData


class SeriesReference(Schema):
    id: int
    name: str
    url: str


class PostSummary(Schema):
    id: int
    title: str
    subtitle: str
    url: str
    public_url: str
    status: Literal['draft', 'published', 'scheduled', 'hidden']
    tags: list[str]
    series: SeriesReference | None
    is_hidden: bool
    is_advertise: bool
    cover_layout: CoverLayout
    cover_image_position: CoverImagePosition
    cover_image_ratio: CoverImageRatio
    created_at: str
    updated_at: str
    published_at: str | None


class PostDetail(PostSummary):
    description: str
    content: str
    content_html: str
    rendered_html: str
    read_time: int


class Pagination(Schema):
    page: int
    limit: int
    total: int


class PostListData(Schema):
    posts: list[PostSummary]
    pagination: Pagination


class PostListEnvelope(Schema):
    data: PostListData


class PostDetailEnvelope(Schema):
    data: PostDetail


class PostBodyPayload(Schema):
    title: str | None = Field(None, description=_('Post title.'))
    content: str | None = Field(
        None,
        description=_('Post body. Prefer the markdown field.'),
    )
    content_html: str | None = Field(None, description=_('HTML body.'))
    markdown: str | None = Field(
        None,
        description=_(
            'Markdown body. This is the recommended body field for new clients.'
        ),
    )
    text_html: str | None = Field(
        None,
        description=_('Compatibility HTML body field for existing clients.'),
    )
    text_md: str | None = Field(
        None,
        description=_('Compatibility Markdown body field for existing clients.'),
    )
    content_type: Literal['html', 'markdown'] | None = Field(
        None,
        description=_(
            'Body format. When the markdown field is provided, Markdown is used.'
        ),
    )
    subtitle: str | None = Field(None, description=_('Post subtitle.'))
    description: str | None = Field(
        None,
        description=_('Description for SEO and sharing.'),
    )
    tags: list[str] | str | None = Field(
        None,
        description=_('Tags. Accepts a string or an array of strings.'),
    )
    tag: list[str] | str | None = Field(
        None,
        description=_('Compatibility tag field for existing clients.'),
    )
    series_id: int | None = Field(
        None,
        description=_('ID of one of your series.'),
    )
    series_url: str | None = Field(
        None,
        description=_(
            'URL of one of your series. Use this to specify the URL directly '
            'instead of series_id.'
        ),
    )
    slug: str | None = Field(None, description=_('Custom post URL.'))
    url: str | None = Field(
        None,
        description=_('Compatibility post URL field for existing clients.'),
    )
    is_hidden: bool | None = Field(
        None,
        description=_('Whether to hide the post.'),
    )
    is_hide: bool | None = Field(
        None,
        description=_('Compatibility hidden-state field for existing clients.'),
    )
    is_advertise: bool | None = Field(
        None,
        description=_('Whether the post is promotional or advertising content.'),
    )
    cover_layout: CoverLayout | None = Field(
        None,
        description=_('Cover layout on the post detail page.'),
    )
    cover_image_position: CoverImagePosition | None = Field(
        None,
        description=_('Featured image position in the split cover layout.'),
    )
    cover_image_ratio: CoverImageRatio | None = Field(
        None,
        description=_('Featured image ratio in the default or split cover layout.'),
    )
    published_at: str | None = Field(
        None,
        description=_('Scheduled publication time as an ISO 8601 datetime string.'),
    )


class PostMutationPayload(PostBodyPayload):
    status: Literal['draft', 'published', 'scheduled'] | None = Field(
        None,
        description=_('Creation status. The default is draft.'),
    )


class PostUpdatePayload(PostBodyPayload):
    expected_updated_at: str | None = Field(
        None,
        description=_(
            'Last updated_at value used to prevent concurrent updates.'
        ),
    )


class PostPublishPayload(PostBodyPayload):
    pass


class DeletePostData(Schema):
    deleted: bool | None = None
    id: int | None = None
    can_delete: bool | None = None
    post: PostSummary | None = None


class DeletePostEnvelope(Schema):
    data: DeletePostData


class TagData(Schema):
    name: str
    post_count: int


class TagListData(Schema):
    tags: list[TagData]


class TagListEnvelope(Schema):
    data: TagListData


class SeriesData(Schema):
    id: int
    name: str
    url: str
    description: str
    is_hidden: bool
    post_count: int
    created_at: str
    updated_at: str


class SeriesListData(Schema):
    series: list[SeriesData]


class SeriesListEnvelope(Schema):
    data: SeriesListData


class ImageUploadData(Schema):
    url: str


class ImageUploadEnvelope(Schema):
    data: ImageUploadData

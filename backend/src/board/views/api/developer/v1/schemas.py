from typing import Any, Literal

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
    title: str | None = Field(None, description='포스트 제목입니다.')
    content: str | None = Field(None, description='본문입니다. markdown 필드를 우선 사용하세요.')
    content_html: str | None = Field(None, description='HTML 본문입니다.')
    markdown: str | None = Field(None, description='Markdown 본문입니다. 새 클라이언트의 권장 본문 필드입니다.')
    text_html: str | None = Field(None, description='기존 클라이언트를 위한 HTML 본문 호환 필드입니다.')
    text_md: str | None = Field(None, description='기존 클라이언트를 위한 Markdown 본문 호환 필드입니다.')
    content_type: Literal['html', 'markdown'] | None = Field(
        None,
        description='본문 형식입니다. markdown 필드를 보내면 markdown으로 처리됩니다.',
    )
    subtitle: str | None = Field(None, description='포스트 부제목입니다.')
    description: str | None = Field(None, description='SEO/공유용 설명입니다.')
    tags: list[str] | str | None = Field(None, description='태그 목록입니다. 문자열 또는 문자열 배열을 사용할 수 있습니다.')
    tag: list[str] | str | None = Field(None, description='기존 클라이언트를 위한 태그 호환 필드입니다.')
    series_id: int | None = Field(None, description='내 시리즈 ID입니다.')
    series_url: str | None = Field(None, description='내 시리즈 URL입니다. series_id보다 직접 URL을 지정할 때 사용합니다.')
    slug: str | None = Field(None, description='사용자 지정 포스트 URL입니다.')
    url: str | None = Field(None, description='기존 클라이언트를 위한 포스트 URL 호환 필드입니다.')
    is_hidden: bool | None = Field(None, description='발행 포스트를 비공개 처리할지 여부입니다.')
    is_hide: bool | None = Field(None, description='기존 클라이언트를 위한 비공개 호환 필드입니다.')
    is_advertise: bool | None = Field(None, description='홍보/광고성 포스트 여부입니다.')
    cover_layout: CoverLayout | None = Field(None, description='상세 화면 커버 배치입니다.')
    cover_image_position: CoverImagePosition | None = Field(None, description='분할 커버에서 대표 이미지 위치입니다.')
    cover_image_ratio: CoverImageRatio | None = Field(None, description='기본/분할 커버에서 대표 이미지 비율입니다.')
    published_at: str | None = Field(None, description='예약 발행 시각입니다. ISO datetime 문자열을 사용합니다.')


class PostMutationPayload(PostBodyPayload):
    status: Literal['draft', 'published', 'scheduled'] | None = Field(
        None,
        description='생성 상태입니다. 기본값은 draft입니다.',
    )


class PostUpdatePayload(PostBodyPayload):
    expected_updated_at: str | None = Field(
        None,
        description='동시 수정 방지를 위한 마지막 updated_at 값입니다.',
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

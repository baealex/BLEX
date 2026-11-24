// English source messages with Korean translations.
export const developerKorean = {
  'BLEX Developer API': 'BLEX 개발자 API',
  'Token management': '토큰 관리',
  Account: '계정',
  Posts: '포스트',
  'Tags and series': '태그와 시리즈',
  Images: '이미지',
  'Default Response': '응답',
  'Manage your own posts from external tools.\n\nStart with the [quickstart](/docs/developer-api/quickstart). Create a token in [Token management](/settings/developer-api) and enter the full value in Authorize. Bearer is added automatically.\n\nSuccessful responses contain data; errors contain error. Reading posts requires posts:read. Creating, editing, publishing, deleting, and uploading images requires posts:write.':
    '외부 도구에서 내 포스트를 관리하는 API입니다.\n\n처음이라면 [빠른 시작](/docs/developer-api/quickstart)을 따라 해보세요. [토큰 관리](/settings/developer-api)에서 발급한 전체 토큰을 Authorize에 넣으면 됩니다. Bearer는 자동으로 붙습니다.\n\n성공한 응답은 data, 오류 응답은 error에 담깁니다. 포스트 읽기에는 posts:read, 생성·수정·발행·삭제·이미지 업로드에는 posts:write 권한이 필요합니다.',
  'Enter the full token starting with blex_pat_ from Token management.':
    '토큰 관리에서 발급한 blex_pat_로 시작하는 전체 토큰을 입력하세요.',
  'The post title.': '포스트 제목입니다.',
  'The Markdown body. Start with this field when creating an integration.':
    'Markdown 본문입니다. 처음 사용할 때는 이 필드에 글을 넣으세요.',
  'The HTML body. If markdown is also present, markdown takes priority.':
    'HTML 본문입니다. markdown과 함께 보내면 markdown이 우선합니다.',
  'The post body. New integrations should use markdown.': '본문입니다. 새 연동에는 markdown을 권장합니다.',
  'A body field for existing integrations.': '기존 연동을 위한 본문 필드입니다.',
  'A body field for existing integrations. Its format follows content_type.':
    '기존 연동을 위한 본문 필드입니다. 형식은 content_type을 따릅니다.',
  'The body format. The markdown field always uses Markdown. Other body fields default to html.':
    '본문 형식입니다. markdown 필드는 항상 Markdown으로 처리됩니다. 다른 본문 필드의 기본 형식은 html입니다.',
  'The subtitle displayed below the title.': '제목 아래에 표시할 부제목입니다.',
  'A short description for search results and shared links.': '검색 결과와 링크 공유에 사용할 짧은 설명입니다.',
  'An array of tags. A comma-separated string is also accepted.':
    '태그 배열입니다. 쉼표로 구분한 문자열도 사용할 수 있습니다.',
  'A compatibility alias for tags.': 'tags의 호환용 이름입니다.',
  'The ID of one of your series. Omit it if no series is needed.':
    '내 시리즈의 ID입니다. 시리즈를 지정하지 않으면 생략하세요.',
  'The URL name of one of your series. Takes priority over series_id when both are sent.':
    '내 시리즈의 URL 이름입니다. series_id와 함께 보내면 이 값이 우선합니다.',
  'The final part of the post URL. Generated automatically if omitted. Cannot be changed after publishing.':
    '포스트 주소의 마지막 부분입니다. 생략하면 자동으로 만듭니다. 발행한 뒤에는 바꿀 수 없습니다.',
  'A compatibility alias for slug.': 'slug의 호환용 이름입니다.',
  'Set true to make the post private to its author.': 'true이면 작성자만 볼 수 있는 비공개 포스트로 설정합니다.',
  'The scheduled publication time, for example 2099-01-01T09:00:00+09:00. Ignored when creating a draft or updating with PATCH.':
    '예약 발행 시각입니다. 예: 2099-01-01T09:00:00+09:00. 초안 생성과 PATCH 수정에서는 무시됩니다.',
  'Send updated_at from the last response to prevent overwriting another request’s changes. Applies to PATCH updates.':
    '마지막 응답의 updated_at을 그대로 보내면 다른 요청의 수정을 덮어쓰는 것을 막습니다. PATCH 수정에 적용됩니다.',
  'The initial post status. Defaults to draft. Ignored in update and publish requests.':
    '만들 때의 상태입니다. 생략하면 draft(초안)입니다. 수정·발행 요청에서는 무시됩니다.',
  'draft: draft, published: public, scheduled: scheduled, hidden: private. Omit to fetch all statuses.':
    'draft: 초안, published: 공개, scheduled: 예약, hidden: 비공개. 생략하면 전체를 가져옵니다.',
  'Page number. Defaults to {page}; values below 1 are treated as 1.':
    '페이지 번호입니다. 기본값은 {page}이며 1보다 작으면 1로 처리합니다.',
  'Posts per page. Defaults to {limit}; values are adjusted to 1–{max}.':
    '한 번에 가져올 개수입니다. 기본값은 {limit}이며 1~{max}로 조정됩니다.',
  'Search the title, body, description, and tags.': '제목, 본문, 설명, 태그에서 찾을 검색어입니다.',
  'Tag names. Separate multiple tags with commas to match any of them.':
    '태그 이름입니다. 쉼표로 여러 개를 보내면 하나라도 일치하는 글을 찾습니다.',
  'Only fetch posts in this series.': '이 시리즈에 속한 글만 가져옵니다.',
  'data.id from a create or read response.': '생성 또는 조회 응답의 data.id입니다.',
  'Add this path to the site’s address to open the post. Drafts and private posts are only visible to their author.':
    '사이트 주소를 앞에 붙여서 여는 포스트 경로입니다. 초안과 비공개 글은 작성자만 볼 수 있습니다.',
  'The converted HTML body.': '변환된 HTML 본문입니다.',
  'Check your token and account': '토큰과 내 계정 확인',
  'Call this first to check your connection. No read or write scope is required.':
    '연결이 잘 되었는지 확인할 때 먼저 호출하세요. 별도의 읽기·쓰기 권한이 필요하지 않습니다.',
  'List your posts': '내 포스트 목록',
  'Requires posts:read. Returns your posts ordered by most recently updated. Other authors’ posts are excluded.':
    'posts:read 권한이 필요합니다. 최근 수정한 글부터 가져옵니다. 다른 작성자의 글은 포함되지 않습니다.',
  'Search your posts': '내 포스트 검색',
  'Requires posts:read. Combine a search term, tags, a series, and a status.':
    'posts:read 권한이 필요합니다. 검색어, 태그, 시리즈, 상태를 함께 사용할 수 있습니다.',
  'Get a post': '포스트 하나 가져오기',
  'Requires posts:read. Only your own posts are available, including draft bodies.':
    'posts:read 권한이 필요합니다. 내 글만 조회할 수 있으며, 초안 본문도 가져올 수 있습니다.',
  'Create a post': '포스트 만들기',
  'Requires posts:write. Omit status to save a private draft. Send status: published to publish, or status: scheduled with published_at to schedule.':
    'posts:write 권한이 필요합니다. status를 생략하면 공개되지 않는 초안으로 저장합니다. 발행하려면 status: published, 예약하려면 status: scheduled와 published_at을 보내세요.',
  'Update a post': '포스트 수정',
  'Requires posts:write. Send only changed fields. Send expected_updated_at to receive 409 if another request has already updated the post. status and published_at do not change publication state here.':
    'posts:write 권한이 필요합니다. 바꿀 항목만 보내세요. expected_updated_at을 보내면 다른 요청이 먼저 수정했을 때 409 오류를 받습니다. status와 published_at으로 발행 상태를 바꿀 수는 없습니다.',
  'Publish a draft': '초안 발행',
  'Requires posts:write. An empty body publishes immediately. Send published_at to schedule. A published or scheduled post cannot be published again.':
    'posts:write 권한이 필요합니다. 빈 본문으로 보내면 바로 발행합니다. published_at을 보내면 예약합니다. 이미 발행하거나 예약한 글은 다시 발행할 수 없습니다.',
  'Move a post to trash': '포스트를 휴지통으로 이동',
  'Requires posts:write. Check the target first with dry_run=true. Trashed posts can be restored on the site.':
    'posts:write 권한이 필요합니다. 먼저 dry_run=true로 확인할 수 있습니다. 휴지통으로 옮긴 글은 사이트에서 복원할 수 있습니다.',
  'Set true to check the target without deleting it. Other spellings such as dry-run are refused with 422, not ignored.':
    'true이면 실제로 삭제하지 않고 대상만 확인합니다. dry-run처럼 다르게 쓴 이름은 무시하지 않고 422로 거절합니다.',
  'List your tags': '내 태그 목록',
  'Requires posts:read. Returns tags and usage counts from your posts, excluding trash.':
    'posts:read 권한이 필요합니다. 휴지통을 제외한 내 글의 태그와 사용 횟수를 가져옵니다.',
  'List your series': '내 시리즈 목록',
  'Requires posts:read. Use a returned id as series_id when creating or updating a post.':
    'posts:read 권한이 필요합니다. 응답의 id를 포스트 생성·수정 시 series_id로 사용할 수 있습니다.',
  'Upload a body image': '본문 이미지 업로드',
  'Requires posts:write. Send a file in the image field as multipart/form-data. Use data.url from the response in a Markdown image.':
    'posts:write 권한이 필요합니다. image에 파일을 넣어 multipart/form-data로 전송하세요. 응답의 data.url을 Markdown 이미지 주소에 사용할 수 있습니다.',
  'A Bearer token is required.': 'Bearer 토큰이 필요합니다.',
  'Invalid token.': '올바르지 않은 토큰입니다.',
  'This token has expired or been revoked.': '토큰이 만료되었거나 폐기되었습니다.',
  'This user is inactive.': '비활성화된 계정입니다.',
  'The Developer API requires author access.': '개발자 API를 사용하려면 작가 권한이 필요합니다.',
  '{scope} scope is required.': '{scope} 권한이 필요합니다.',
  'Unsupported status.': '지원하지 않는 포스트 상태입니다.',
  'The request payload could not be validated.': '보낸 데이터의 형식이나 값을 확인해 주세요.',
  'series_id must be a number.': 'series_id는 숫자여야 합니다.',
  'Post not found.': '포스트를 찾을 수 없습니다.',
  'The post was already updated by another request.': '포스트가 이미 다른 요청으로 수정되었습니다.',
  'This post has already been published or scheduled.': '이미 발행되었거나 예약된 포스트입니다.',
  'status must be one of draft, published, or scheduled.': 'status는 draft, published, scheduled 중 하나여야 합니다.',
  'published_at is required when status is scheduled.': '예약 발행에는 published_at이 필요합니다.',
  'content_type must be either html or markdown.': 'content_type은 html 또는 markdown이어야 합니다.',
  'No series matches series_id.': 'series_id에 해당하는 내 시리즈가 없습니다.',
  'Could not complete the request.': '요청을 처리하지 못했습니다.',
  'The request body is too large.': '보낸 데이터가 허용 크기보다 큽니다.',
  'Use a supported Content-Type.': '지원하는 Content-Type으로 요청해 주세요.',
  'Check this field’s type and value.': '이 항목의 형식과 값을 확인해 주세요.',
  'Input should be a valid integer': '올바른 정수를 입력해 주세요.',
  'Unknown query parameter. Use dry_run.': '알 수 없는 쿼리 매개변수입니다. dry_run을 사용해 주세요.',
  'Input should be a valid boolean': '올바른 참·거짓 값을 입력해 주세요.',
  'must be string': '문자열이어야 합니다.',
  'must be object': '객체여야 합니다.',
  'must be array': '배열이어야 합니다.',
  'must be integer': '정수여야 합니다.',
  'must be boolean': '참·거짓 값이어야 합니다.',
  'must be equal to one of the allowed values': '허용된 값 중 하나를 사용해 주세요.',
  'Image files must be {limit} MiB or smaller.': '이미지 파일은 {limit} MiB 이하여야 합니다.',
  'Image upload failed.': '이미지 업로드에 실패했습니다.',
  'No image was provided.': '이미지 파일이 없습니다.',
  'Image uploads are busy. Try again in a moment.': '이미지 업로드가 진행 중입니다. 잠시 후 다시 시도해 주세요.',
  'This file extension is not allowed.': '지원하지 않는 파일 확장자입니다.',
  'You can save up to {limit} drafts.': '임시 저장 글은 최대 {limit}개까지 가능합니다.',
  'Titles can be up to {limit} characters.': '제목은 최대 {limit}자까지 입력할 수 있습니다.',
  'Subtitles can be up to {limit} characters.': '부제목은 최대 {limit}자까지 입력할 수 있습니다.',
  'Descriptions can be up to {limit} characters.': '설명은 최대 {limit}자까지 입력할 수 있습니다.',
  'Post URLs can be up to {limit} characters.': '포스트 URL은 최대 {limit}자까지 입력할 수 있습니다.',
  'Each tag can be up to {limit} characters.': '태그는 각각 최대 {limit}자까지 입력할 수 있습니다.',
  'Too many requests. Try again later.': '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
} as const;

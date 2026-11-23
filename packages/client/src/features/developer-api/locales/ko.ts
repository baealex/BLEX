// English source messages with Korean translations.
export const developerKorean = {
    Copy: '복사',
    Troubleshooting: '오류 해결',
    'BLEX Developer API': 'BLEX 개발자 API',
    'Developer API quickstart': '개발자 API 빠른 시작',
    'Create your first post with a few terminal commands.': '터미널에서 명령어 몇 개로 첫 포스트를 만들어 보세요.',
    'Save a draft first, then publish when you are ready.': '초안으로 먼저 저장하고, 준비되면 발행합니다.',
    'Use a macOS or Linux terminal, or WSL or Git Bash on Windows. You will need curl.':
        'macOS·Linux 터미널 또는 Windows의 WSL·Git Bash에서 따라 할 수 있습니다. curl이 필요합니다.',
    'Quickstart steps': '빠른 시작 순서',
    '1. Create a token': '1. 토큰 만들기',
    '2. Check the connection': '2. 연결 확인하기',
    '3. Save your first draft': '3. 첫 초안 저장하기',
    '4. Publish when ready': '4. 준비되면 발행하기',
    'A token works like a password that lets an external tool use the API with your account.':
        '토큰은 외부 도구가 내 계정으로 API를 사용할 수 있게 하는 비밀번호 같은 값입니다.',
    'Sign in with an author account and open {tokens}.': '작가 계정으로 로그인한 뒤 {tokens}를 엽니다.',
    'Token management': '토큰 관리',
    'Name your token and select both {read} and {write}.': '이름을 정하고 {read}와 {write}을 모두 선택합니다.',
    'Read posts': '포스트 읽기',
    'Write posts': '포스트 작성',
    'Create the token and copy its full value. You can only see the full token once.':
        '토큰을 발급하고 전체 값을 복사합니다. 전체 토큰은 발급할 때 한 번만 표시됩니다.',
    'Replace {token} below with the token you copied, then paste the commands into your terminal. Run the remaining commands in the same terminal.':
        '아래에서 {token}을 방금 복사한 값으로 바꾼 뒤 터미널에 붙여 넣으세요. 이후 명령도 같은 터미널에서 실행합니다.',
    'Set up your terminal': '터미널 준비',
    'Keep your token out of public repositories and posts. If it leaks, revoke it in Token management and create another.':
        '토큰을 공개 저장소나 포스트에 올리지 마세요. 유출되면 토큰 관리에서 폐기하고 다시 발급하세요.',
    'Fetch your account details to check that your token works.':
        '내 계정 정보를 가져와서 토큰이 잘 작동하는지 확인합니다.',
    'Check your account': '계정 확인',
    'If {username} in the response shows your username, you are connected. If you get an error, see {troubleshooting}.':
        '응답의 {username}에 내 아이디가 보이면 연결된 거예요. 오류가 나오면 아래의 {troubleshooting}을 확인하세요.',
    '{title} is the title and {markdown} is the body. Sending {status} saves a draft that other people cannot see yet.':
        '{title}은 제목, {markdown}은 본문입니다. {status}로 보내면 아직 다른 사람에게 공개되지 않습니다.',
    'Create a draft': '초안 만들기',
    '{id} in the response is your new post number. If it is 123, save it as shown below. {replace}.':
        '응답의 {id}가 방금 만든 글의 번호입니다. 예를 들어 번호가 123이면 아래처럼 저장하세요. {replace}.',
    'Replace 123 with the number from your response': '123을 실제 응답의 번호로 바꿔 주세요',
    'Save the post number': '글 번호 저장',
    'You can also review and edit your draft in {posts}. It is fine to stop here.':
        '{posts}에서도 초안을 확인하고 이어서 편집할 수 있습니다. 여기까지만 실행하고 멈춰도 됩니다.',
    'Post management': '글 관리',
    'After reviewing the content, run the command below. {publish}.':
        '내용을 확인했다면 아래 명령을 실행하세요. {publish}.',
    'Your draft will be published immediately and visible to other people':
        '초안이 즉시 발행되어 다른 사람도 볼 수 있습니다',
    'Publish the draft': '초안 발행',
    'You are done when {status} is {published}. Add {url} to this site’s address to open the published post.':
        '응답의 {status}가 {published}이면 완료입니다. {url}을 이 사이트 주소 뒤에 붙이면 발행한 글을 열 수 있습니다.',
    'Try a little more': '이어서 해보기',
    'Expand an example when you need it. Keep using the post number you saved above.':
        '필요할 때 하나씩 펼쳐 보세요. 위에서 저장한 글 번호를 그대로 사용합니다.',
    'Change a post title': '글 제목 수정하기',
    'Send only the fields you want to change. The body and tags you omit are kept.':
        '바꿀 항목만 보내면 됩니다. 생략한 본문과 태그는 유지됩니다.',
    'Update the title': '제목 수정',
    'If several tools edit the same post, use expected_updated_at to prevent conflicts. See the API reference for details.':
        '여러 도구에서 함께 편집한다면 API 문서의 expected_updated_at으로 수정 충돌을 방지할 수 있습니다.',
    'Add an image to the body': '본문에 이미지 넣기',
    'Replace {file} with the path to an image on your computer, then upload it.':
        '{file}을 내 컴퓨터의 이미지 파일 경로로 바꿔서 업로드하세요.',
    'Upload an image': '이미지 업로드',
    'Put {url} from the response into {markdown} and include it in your Markdown body.':
        '응답의 {url}을 {markdown}에 넣어 Markdown 본문에 사용하면 됩니다.',
    'Start here if you get an error': '오류가 나면 여기부터 확인하세요',
    '401 · Check your token': '401 · 토큰을 확인해 주세요',
    'Check that you copied the full token and that it has not expired or been revoked. In a new terminal, run the setup commands from step 1 again.':
        '토큰 전체를 복사했는지, 만료되거나 폐기되지 않았는지 확인하세요. 새 터미널을 열었다면 1번의 준비 명령부터 다시 실행합니다.',
    '403 · Check your token permissions': '403 · 토큰 권한이 부족해요',
    'Use an author account and a token with both Read posts and Write posts selected.':
        '작가 계정인지 확인하고, 포스트 읽기·작성 권한을 모두 선택한 토큰을 사용하세요.',
    '404 · Check your post number': '404 · 글 번호를 확인해 주세요',
    'Set POST_ID to data.id from your response. You can only fetch or edit posts belonging to your account.':
        'POST_ID에 실제 응답의 data.id를 넣었는지 확인하세요. 내 계정으로 만든 글만 가져오거나 수정할 수 있습니다.',
    '409 · The post has changed': '409 · 글 상태가 바뀌었어요',
    'An already published draft cannot be published again. If there is an edit conflict, fetch the latest post and review your changes.':
        '이미 발행한 초안은 다시 발행할 수 없습니다. 수정 충돌이라면 최신 글을 다시 가져온 뒤 변경 내용을 확인하세요.',
    '400 / 422 · Check what you sent': '400 / 422 · 보낸 내용을 확인해 주세요',
    'Read error.message and error.fields in the response. Check JSON quotes and commas, and the values of your fields.':
        '응답의 error.message와 error.fields를 확인하세요. JSON의 따옴표·쉼표나 필드 값이 잘못되었을 수 있습니다.',
    'Need another feature?': '다른 기능이 필요하다면',
    'The API reference covers search, tags, series, and scheduled publishing. Enter your full token in Authorize to send requests from your browser.':
        '검색, 태그, 시리즈, 예약 발행 등은 API 문서에서 확인하세요. Authorize 버튼에 토큰 전체를 넣으면 브라우저에서도 요청을 보낼 수 있습니다.',
    'Open the API reference': '전체 API 문서 열기',
    'Copy {label}': '{label} 복사',
    'Copied.': '복사했습니다.',
    'Could not copy.': '복사에 실패했습니다.'
} as const;

# 소셜 로그인 설정

BLEX의 소셜 로그인 제공자와 자격 증명은 **어드민 설정(DB)** 에서 관리합니다.

현재 지원하는 제공자는 다음 두 가지입니다.

- Google
- GitHub

## 공통 절차

1. 각 제공자 개발자 콘솔에서 OAuth 앱을 만듭니다.
2. Redirect URI 또는 callback URL에 아래 주소를 등록합니다.
   - Google: `https://YOUR_DOMAIN/login/callback/google`
   - GitHub: `https://YOUR_DOMAIN/login/callback/github`
3. BLEX 어드민의 `/admin-settings/login` 로그인 관리 화면으로 이동합니다.
4. **소셜 로그인** 섹션에서 사용할 제공자를 켭니다.
5. 발급받은 **Client ID** 와 **Client Secret** 을 입력하고 저장합니다.
6. 로그아웃 상태에서 로그인/회원가입 화면에 소셜 로그인 버튼이 보이는지 확인합니다.

> 로컬 개발 환경에서는 `https://YOUR_DOMAIN` 대신 `http://localhost:8040`처럼 실제 접속 origin을 사용합니다.

## Google

Google Cloud Console에서 OAuth 클라이언트를 만들 때 웹 애플리케이션 유형을 사용합니다.

- 승인된 리디렉션 URI:
  - 운영: `https://YOUR_DOMAIN/login/callback/google`
  - 로컬: `http://localhost:8040/login/callback/google`

필요한 사용자 정보는 기본 scope(`openid email profile`)로 요청됩니다.

## GitHub

GitHub Developer settings에서 OAuth App을 만듭니다.

- Authorization callback URL:
  - 운영: `https://YOUR_DOMAIN/login/callback/github`
  - 로컬: `http://localhost:8040/login/callback/github`

필요한 사용자 정보는 기본 scope(`user:email`)로 요청됩니다.

## 동작 기준

- 제공자가 꺼져 있으면 로그인/회원가입 화면에 버튼이 나오지 않습니다.
- 제공자가 켜져 있어도 Client ID 또는 Client Secret이 비어 있으면 버튼이 나오지 않습니다.
- 직접 callback URL을 호출해도 제공자가 꺼져 있으면 로그인이 차단됩니다.
- Client Secret 입력칸을 비워 저장하면 기존 Secret이 유지됩니다.
- 저장된 Secret을 삭제하려면 **저장된 Client Secret 삭제** 를 체크하고 저장합니다.
- Client Secret은 `CIPHER_KEY`로 암호화되어 DB에 저장됩니다.

## 문제 해결

- `redirect_uri_mismatch`가 나오면 `SITE_URL` 기준 callback URL이 제공자 콘솔에 등록된 주소와 같은지 확인합니다. HTTPS 프록시는 공개 호스트와 연결 방식이 BLEX에 전달되도록 구성하세요.
- 버튼이 보이지 않으면 BLEX 어드민에서 제공자가 켜져 있고 Client ID가 저장되어 있는지 확인합니다.
- 인증 후 실패하면 Client Secret이 저장되어 있는지 확인합니다.
- `SITE_URL`을 실제 접속 origin으로 설정합니다. Docker Compose 기본 주소는 `http://localhost:20002`이므로 이 경우 콜백도 같은 포트를 사용합니다. HTTPS 프록시는 [자체 호스팅 가이드](SELF_HOSTING.md)를 따릅니다.
- `CIPHER_KEY`를 잃어버리거나 변경하면 저장된 Client Secret을 복호화할 수 없습니다. 운영 백업 대상에 반드시 포함하세요.

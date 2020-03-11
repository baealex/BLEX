# BLEX ![django version](https://img.shields.io/badge/django-2.2.10-blue?style=flat-square) ![license mit](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)

![BLEX LOGO](https://user-images.githubusercontent.com/35596687/70400241-3f101f00-1a6d-11ea-8952-9f622224c57e.png)

> BLOG EXPRESS ME, "블로그는 나를 표현한다." 기록은 인간에게 가장 오래된 습관이며 블로그는 여전히 자신을 표현하기 위한 완벽한 공간입니다.

블로그들의 장점에 집중하고 더 나은 서비스를 개발하고자 합니다. 네이버 블로그의 '접근성', 티스토리 블로그의 '자유로움', 깃허브 블로그의 '생산성', 미디엄의 '심미성' 그 외 블로그를 운영하며 다져진 노하우를 잘 녹여낸 블로그입니다.

<br>

## How To Install?

#### Linux — Debian :

- 가상환경 및 패키지 설치

```shell
# 두 명령어중 동작하는 명령어로 설치
sudo apt-get install python3-venv
sudo pip install virtualenv

python3 -m venv mvenv
source mvenv/bin/activate
pip install -U -r requirements.txt
```

- 파일 수정

기본적으로 \_1이 붙은 파일들은 반드시 숨겨져야 할 정보들를 포함되어 임시적으로 생성된 대체 파일들입니다. `telegram_token_1.py`과 `settings_1.py` 그리고 `base_1.html`이 존재하고 이들은 반드시 수정이 필요하며 수정이 완료된 후에는 \_1이라는 키워드를 제거할 필요가 있습니다.

`main/settings_1.py`

```python
STATIC_URL = 'https://static.domain.com/assets/'
STAITC_ROOT=os.path.join('/static/assets/')

MEDIA_URL = 'https://static.domain.com/'
MEDIA_ROOT = os.path.join('/static/')

...

EMAIL_HOST_USER = '********@gmail.com'
EMAIL_HOST_PASSWORD = '********'
```

설정 파일의 각 변수를 지정하셔야 합니다. 현재 BLEX의 경우에는 `static`, `media` 파일은 `NginX`에서 별도의 서버를 열어 제공하고 있습니다.

`board` > `telegram_token_1.py`

자신의 텔레그램 봇의 키 값을 작성하세요. 없으면 비워놔도 무방합니다.

`board/template` > `base_1.html`

```
{% with site_title='BLEX' site_url='https://site.example.com' site_description='Site Description' static_url='https://static.example.com' %}
```

상단의 `with` 변수를 자신에 환경에 맞게 변경합니다. static_url의 경우에는 settings에서 사용한 주소와 같은 주소로 사용하시길 권장합니다.

`board/template/posts` > `wirte.html`

글쓰기 레이아웃의 경우에도 상단에 변수가 나열되어 있으므로 수정하시길 권장합니다.

- 데이터 베이스 동기화 및 서비스 실행

```shell
python manage.py migrate
python manage.py migrate --run-syncdb

uwsgi --socket :8000 --module main.wsgi --enable-threads
```

- `NginX`에서 `uwsgi` 연동

```nginx
location / {
    uwsgi_pass 127.0.0.1:8000;
    include /.../BLEX/src/uwsgi_params;
}
```

<br>

## 업데이트 내역

- [진행상황, Notion](https://www.notion.so/64ccf14e7b7f4799a282b2eddfc4d5a6?v=6babe35461c74a828ca08654b94bcaca)
- [업데이트 내역, BLEX — Thread](https://blex.me/thread/%EA%B0%9C%EB%B0%9C%EB%85%B8%ED%8A%B8)

<br>

## 개발자 정보	

Jino Bae. – [BLOG](https://blex.me/@baealex) – im@baejino.com

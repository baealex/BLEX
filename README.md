# BLEX ![django version](https://img.shields.io/badge/django-2.2.10-blue?style=flat-square) ![license mit](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)

> BLOG EXPRESS ME, "블로그는 나를 표현한다" 기록은 인간에게 가장 오래된 습관이며 블로그는 여전히 자신을 표현하기 위한 완벽한 공간입니다.

더 나은 블로그를 만들기 위해 블로그만 4번 이사한 블로거가 마지막으로 정착하기 위해 직접 제작하는 블로그 서비스. 사용해봤던 블로그들의 장점에 집중하고 더 나은 서비스를 개발하고자 합니다. 네이버 블로그의 '쉽다!', 티스토리 블로그의 '자유롭다!', 깃허브 블로그의 '마크다운 글쓰기!', 미디엄의 '아름답다!' 등 그 외 블로그를 운영하며 다져진 노하우를 잘 녹여낸 블로그입니다.

![BLEX LOGO](https://user-images.githubusercontent.com/35596687/70400241-3f101f00-1a6d-11ea-8952-9f622224c57e.png)

<br>

## 설치 방법

#### 리눅스(데비안) :

- 가상환경 및 패키지 설치

```shell
# 두 명령어중 동작하는 명령어로 설치
sudo apt-get install python3-venv
sudo pip install virtualenv

python3 -m venv mvenv
source mvenv/bin/activate
pip install -U -r requirements.txt
```

- 설정 파일 및 기본 템플릿 수정

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

설정 파일의 각 변수를 지정하세요. `Static`, `Media` 파일은 `NginX`에서 별도의 서버를 열어 제공하였습니다. 수정후 `settings.py`로 이름을 변경하세요.

`board/template` > `base_1.html`, `board/template/small` > `base_1.html`

```
{% with site_title='BLEX' site_url='https://site.example.com' site_description='Site Description' static_url='https://static.example.com' api_url='https://api.example.com'%}
```

상단의 `with` 변수를 자신에 환경에 맞게 변경하세요. `API` 역시 별도의 `PHP` 서버를 개설하여 사용하였습니다. 수정후 `base.html`로 이름을 변경하세요.

- 데이터 베이스 동기화 및 서비스 실행

```shell
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

[기술 스택 및 로그](https://blex.kr/@baealex/%EA%B0%9C%EB%B0%9C%EB%85%B8%ED%8A%B8)

<br>

## 개발자 정보	

Jino Bae. – [BLOG](https://baejino.com) – im@baejino.com
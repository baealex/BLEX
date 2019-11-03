# 설치 방법	

1.파이썬 가상환경(데비안)
```shell
sudo apt-get install python-venv

# 위 명령어가 동작하지 않을 경우
sudo pip install virtualenv
```

2.가상환경 생성
```shell
python -m venv mvenv
```

3.pip install
```shell
pip install -U -r requirements.txt
```

4.create db
```shell
python manage.py migrate --run-syncdb
```

5.start server
```shell
python manage.py runserver

# or user uwsgi

pip install uwsgi
uwsgi --http :8000 --module main.wsgi
```

6.service
```shell
uwsgi --socket :8000 --module main.wsgi --enable-threads
```

```nginx
location / {
    uwsgi_pass 127.0.0.1:8000;
    include /.../BLEX/src/uwsgi_params;
}
```

<br>

`main/settings_1.py`

```python
STATIC_URL = 'https://static.domain.com/assets/'
STAITC_ROOT=os.path.join('/static/assets/')

MEDIA_URL = 'https://static.domain.com/'
MEDIA_ROOT = os.path.join('/static/')
```

Static, Media 파일은 Nginx에서 서버를 열어서 별도로 제공하였습니다. 수정후 `settings.py`로 이름을 변경하세요.

<br>

`board/template` > `main_1.py`

```
{% with site_title='Mediummm' site_url='https://site.example.com' site_description='Site Description' static_url='https://static.example.com' api_url='https://api.example.com'%}
```

사이트의 이름, Static 서버와 API(이미지 업로드와 마크다운 변환 등)서버의 주소를 기입한 후 `main.html`로 이름을 변경하세요.
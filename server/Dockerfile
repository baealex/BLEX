FROM ubuntu:18.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update

# install Compiler
RUN apt-get install -y build-essential
RUN apt-get install -y gcc
RUN apt-get install -y ffmpeg
RUN apt-get install -y python3-pip python3-dev
RUN apt-get install -y python3-psycopg2

RUN apt-get install -y rsync
RUN apt-get install -y sshpass

COPY ./requirements.txt /app/

WORKDIR /app
RUN pip3 install -r requirements.txt

COPY ./src /app
RUN [ ! -f main/settings.py ] && cp main/settings_1.py main/settings.py ; exit 0
RUN [ ! -f board/templates/board/source.html ] && cp board/templates/board/source_1.html board/templates/board/source.html ; exit 0
RUN [ ! -f db.sqlite3 ] && python3 manage.py migrate && python3 manage.py migrate --run-syncdb ; exit 0

WORKDIR /app
ENTRYPOINT ["uwsgi"]
CMD ["--socket", ":9000", "--module", "main.wsgi", "--enable-threads", "-b", "32768"]
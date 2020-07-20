FROM ubuntu:18.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update

# install Compiler
RUN apt-get install -y build-essential
RUN apt-get install -y gcc
RUN apt-get install -y ffmpeg
RUN apt-get install -y python3-pip python3-dev
RUN apt-get install -y python3-psycopg2

COPY ./requirements.txt /app/
WORKDIR /app
RUN pip3 install -r requirements.txt

COPY ./src /app

ENTRYPOINT ["uwsgi"]
CMD ["--socket", ":9000", "--module", "main.wsgi", "--enable-threads", "-b", "32768"]
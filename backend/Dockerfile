FROM ubuntu:20.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update

RUN apt-get install -y \
    build-essential libssl-dev zlib1g-dev libbz2-dev \
    libreadline-dev libsqlite3-dev wget curl llvm \
    libncurses5-dev libncursesw5-dev xz-utils tk-dev \
    libffi-dev liblzma-dev python-openssl git gcc ffmpeg

ENV LANG="C.UTF-8" \
    LC_ALL="C.UTF-8" \
    PATH="/root/.pyenv/shims:/root/.pyenv/bin:$PATH" \
    PYENV_ROOT="/root/.pyenv" \
    PYENV_SHELL="bash"

ENV PYTHON_VERSION=3.9.7

RUN git clone https://github.com/pyenv/pyenv.git $PYENV_ROOT \
    && pyenv install $PYTHON_VERSION \
    && pyenv global $PYTHON_VERSION

ENV PYTHONIOENCODING=utf-8

COPY ./src/requirements.txt /app/

WORKDIR /app
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY ./src /app

ENTRYPOINT ["uwsgi"]
CMD ["--socket", ":9000", "--module", "main.wsgi", "--enable-threads", "-b", "32768"]
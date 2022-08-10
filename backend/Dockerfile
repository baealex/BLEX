FROM baealex/blex-backend-base

COPY ./src/requirements.txt /app/

WORKDIR /app
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY ./src /app

# ENV STATIC_URL=
# RUN python manage.py collectstatic --noinput

ENTRYPOINT ["uwsgi"]
CMD ["--socket", ":9000", "--module", "main.wsgi", "--enable-threads", "-b", "32768"]

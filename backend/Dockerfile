FROM baealex/blex-backend-base

COPY ./src/requirements.txt /app/

WORKDIR /app
RUN pip install -r requirements.txt --use-pep517

COPY ./src /app

# ENV STATIC_URL=
# RUN python manage.py collectstatic --noinput

ENTRYPOINT ["uwsgi"]
CMD ["--socket", ":9000", "--module", "main.wsgi", "-b", "32768", "--max-requests", "5000", "--master", "--harakiri", "120", "--vacuum", "--die-on-term", "--no-orphans", "--single-interpreter", "--enable-threads", "--threads", "2"]

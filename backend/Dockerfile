FROM node:21-alpine AS islands-builder

COPY ./islands/ /app/islands/
COPY ./src/board/templates/ /app/src/board/templates/

WORKDIR /app/islands

RUN npm install

RUN npm run build

FROM baealex/blex-backend-base

COPY ./src/requirements.txt /app/

WORKDIR /app
RUN pip install -r requirements.txt --use-pep517

COPY ./src /app

COPY --from=islands-builder /app/src/static/islands/ /app/static/islands/

ENV STATIC_URL=/static/
ENV CIPHER_KEY=""
RUN python manage.py collectstatic --noinput

ENTRYPOINT ["uwsgi"]
CMD ["--socket", ":9000", "--module", "main.wsgi", "-b", "32768", "--max-requests", "5000", "--master", "--harakiri", "120", "--vacuum", "--die-on-term", "--no-orphans", "--single-interpreter", "--enable-threads", "--threads", "2"]

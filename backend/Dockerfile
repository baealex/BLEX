# FROM node:21-alpine AS islands-builder
# 
# COPY ./islands/ /app/islands/
# COPY ./src/board/templates/ /app/src/board/templates/
# 
# WORKDIR /app/islands
# 
# RUN npm i -g pnpm
# RUN pnpm i
# 
# RUN npm run build

FROM baealex/blex-backend-base

COPY ./src/requirements.txt /app/

WORKDIR /app
RUN pip install -r requirements.txt --use-pep517

COPY ./src /app

ENV STATIC_URL=/static/
ENV CIPHER_KEY=""
# RUN python manage.py collectstatic --noinput
# COPY --from=islands-builder /app/src/static/islands/ /app/static/islands/

ENTRYPOINT ["gunicorn"]
CMD ["--bind", "0.0.0.0:8000", "--workers", "4", "main.wsgi:application"]

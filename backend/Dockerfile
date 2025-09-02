FROM node:22-alpine AS islands-builder

COPY ./islands/package.json /app/islands/package.json
COPY ./islands/pnpm-lock.yaml /app/islands/pnpm-lock.yaml

WORKDIR /app/islands

RUN npm i -g pnpm
RUN pnpm i

COPY ./islands/ /app/islands/
COPY ./src/board/templates/ /app/src/board/templates/

RUN pnpm build



#####

FROM baealex/blex-backend-base AS backend-stage

COPY ./src/requirements.txt /app/

WORKDIR /app
RUN pip install -r requirements.txt --use-pep517

COPY ./src /app

ENV CIPHER_KEY=""
ENV RESOURCE_URL=""
RUN python manage.py collectstatic --noinput
COPY --from=islands-builder /app/src/resources/staticfiles/islands/ /app/resources/staticfiles/islands/

#####

FROM nginx:alpine AS nginx-stage

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=backend-stage /app/resources/ /resources/

#####

FROM backend-stage
ENTRYPOINT ["gunicorn"]
CMD ["--bind", "0.0.0.0:8000", "--workers", "4", "--access-logfile", "-", "--log-level", "info", "main.wsgi:application"]

FROM node:22-alpine AS islands-builder

COPY ./islands/package.json /app/islands/package.json
COPY ./islands/pnpm-lock.yaml /app/islands/pnpm-lock.yaml
COPY ./islands/pnpm-workspace.yaml /app/islands/pnpm-workspace.yaml
COPY ./islands/apps/remotes/package.json /app/islands/apps/remotes/package.json
COPY ./islands/packages/ui/package.json /app/islands/packages/ui/package.json
COPY ./islands/packages/editor/package.json /app/islands/packages/editor/package.json

WORKDIR /app/islands

RUN npm i -g pnpm
RUN pnpm i --frozen-lockfile

COPY ./islands/ /app/islands/
COPY ./src/board/templates/ /app/src/board/templates/

RUN pnpm build

#####

FROM python:3.12-slim AS backend-builder

COPY ./src/requirements.txt /app/

WORKDIR /app
RUN pip install --prefix=/install -r requirements.txt --use-pep517

#####

FROM python:3.12-slim AS backend-runner

ENV PYTHONUNBUFFERED=1
ENV CIPHER_KEY=""
ENV RESOURCE_URL=""

COPY --from=backend-builder /install /usr/local
COPY ./src /app

WORKDIR /app

RUN python manage.py collectstatic --noinput

#####

FROM nginx:alpine AS nginx-stage

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=backend-runner /app/resources/ /resources/
COPY --from=islands-builder /app/src/resources/staticfiles/islands/ /resources/staticfiles/islands/

#####

FROM backend-runner

# Copy islands static files to the final backend image as well if needed for serving or just consistency
COPY --from=islands-builder /app/src/resources/staticfiles/islands/ /app/resources/staticfiles/islands/

ENTRYPOINT ["gunicorn"]
CMD ["--bind", "0.0.0.0:8000", "--workers", "4", "--access-logfile", "-", "--log-level", "info", "main.wsgi:application"]

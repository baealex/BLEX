ARG PYTHON_IMAGE=python:3.12-slim-trixie
ARG PIP_VERSION=26.2.2

FROM --platform=$BUILDPLATFORM node:24.22.1-alpine AS islands-builder

COPY ./islands/package.json /app/islands/package.json
COPY ./islands/pnpm-lock.yaml /app/islands/pnpm-lock.yaml
COPY ./islands/pnpm-workspace.yaml /app/islands/pnpm-workspace.yaml
COPY ./islands/patches/ /app/islands/patches/
COPY ./islands/apps/remotes/package.json /app/islands/apps/remotes/package.json
COPY ./islands/packages/ui/package.json /app/islands/packages/ui/package.json
COPY ./islands/packages/editor/package.json /app/islands/packages/editor/package.json

WORKDIR /app/islands

ARG PNPM_VERSION=11.17.0
RUN npm i -g pnpm@${PNPM_VERSION}
RUN pnpm i --frozen-lockfile

COPY ./islands/ /app/islands/
COPY ./src/board/templates/ /app/src/board/templates/

RUN pnpm build

#####

FROM ${PYTHON_IMAGE} AS backend-builder

ARG PIP_VERSION
ARG BROTLI_VERSION=1.2.1
ARG BROTLI_SHA256=98d35d11a78dc453aebb7d10c3748f3f73ff78c8267c0dc697b8631f67bf7e8f

# Temporary native override until Pillow ships wheels with patched Brotli.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends build-essential cmake curl patchelf \
    && curl --fail --silent --show-error --location --retry 3 \
        "https://github.com/google/brotli/archive/refs/tags/v${BROTLI_VERSION}.tar.gz" \
        --output /tmp/brotli.tar.gz \
    && echo "${BROTLI_SHA256}  /tmp/brotli.tar.gz" | sha256sum --check \
    && mkdir /tmp/brotli \
    && tar -xzf /tmp/brotli.tar.gz --strip-components=1 -C /tmp/brotli \
    && cmake -S /tmp/brotli -B /tmp/brotli/build \
        -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/opt/brotli \
        -DCMAKE_INSTALL_LIBDIR=lib -DBROTLI_BUILD_TOOLS=OFF -DBUILD_SHARED_LIBS=ON \
    && cmake --build /tmp/brotli/build --parallel 2 --target brotlidec brotlicommon \
    && mkdir -p /opt/brotli/lib \
    && cp -a /tmp/brotli/build/libbrotlidec.so* /tmp/brotli/build/libbrotlicommon.so* /opt/brotli/lib/ \
    && cp /tmp/brotli/LICENSE /opt/brotli/LICENSE \
    && rm -rf /tmp/brotli /tmp/brotli.tar.gz /var/lib/apt/lists/*

COPY ./src/requirements.txt /app/
COPY scripts/patch_pillow_brotli.py /tmp/patch_pillow_brotli.py

WORKDIR /app
RUN python -m pip install --no-cache-dir --upgrade "pip==${PIP_VERSION}" \
    && python -m pip install \
    --prefix=/install \
    --no-compile \
    --no-cache-dir \
    --use-pep517 \
    -r requirements.txt \
    && python /tmp/patch_pillow_brotli.py /install /opt/brotli "$BROTLI_VERSION" "$BROTLI_SHA256"

COPY ./src /runtime-src
RUN rm -f /runtime-src/README.md /runtime-src/requirements.txt \
    && find /runtime-src/board/templates -type f \
        \( -name '*.alpine.ts' -o -name '*.scss' -o -name 'tsconfig.json' \) \
        -delete

#####

FROM ${PYTHON_IMAGE} AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RESOURCE_URL=""

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade --yes --no-install-recommends \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends nginx \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/* /var/cache/debconf/*

COPY --from=backend-builder /install /usr/local
COPY scripts/check_pillow_brotli.py /usr/local/libexec/blex/check_pillow_brotli.py
RUN python /usr/local/libexec/blex/check_pillow_brotli.py
# Package installation belongs to the builder, not the running service.
RUN python -m pip uninstall --yes pip \
    && python -c "import ensurepip, shutil; shutil.rmtree(ensurepip.__path__[0])"
COPY --from=backend-builder /runtime-src /app
COPY nginx.conf /etc/nginx/nginx.conf

WORKDIR /app

RUN CIPHER_KEY="" python manage.py collectstatic --noinput \
    && find /app/resources/staticfiles -type f -name '*.map' -delete
COPY --from=islands-builder /app/src/resources/staticfiles/islands/ /app/resources/staticfiles/islands/
RUN nginx -t

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
STOPSIGNAL SIGTERM

ENTRYPOINT ["/entrypoint.sh"]
CMD ["--bind", "127.0.0.1:8000", "--workers", "1", "--access-logfile", "-", "--log-level", "info", "main.wsgi:application"]

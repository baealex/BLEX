FROM --platform=$BUILDPLATFORM node:24.22.1-alpine AS web-builder
ARG PNPM_VERSION=11.17.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY patches/ ./patches/
COPY packages/server/package.json ./packages/server/package.json
COPY packages/web/package.json ./packages/web/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/editor/package.json ./packages/editor/package.json
RUN npm i -g pnpm@${PNPM_VERSION} && pnpm i --frozen-lockfile --filter . --filter '@blex/web...'
COPY packages/web ./packages/web
COPY packages/ui ./packages/ui
COPY packages/editor ./packages/editor
RUN pnpm exec turbo run build --filter=@blex/web && find /app/packages/server/dist/web -name '*.map' -delete

FROM node:24.22.1-alpine AS node-base
WORKDIR /app

FROM node-base AS node-binary
RUN apk add --no-cache binutils && strip --strip-unneeded /usr/local/bin/node

FROM node-base AS build
ARG PNPM_VERSION=11.17.0
RUN npm i -g pnpm@${PNPM_VERSION}
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY packages/server/package.json ./packages/server/package.json
COPY packages/web/package.json ./packages/web/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/editor/package.json ./packages/editor/package.json
COPY packages/server/prisma ./packages/server/prisma
RUN pnpm i --frozen-lockfile --filter @blex/server
COPY packages/server/tsconfig.json packages/server/vite.config.ts ./packages/server/
COPY packages/server/src ./packages/server/src
COPY packages/server/scripts ./packages/server/scripts
RUN pnpm --filter @blex/server run build

FROM build AS traced-files
WORKDIR /app/packages/server
RUN node scripts/trace-runtime.mjs /traced dist/src/main.js node_modules/prisma/build/index.js \
    && for engine in /app/node_modules/.pnpm/@prisma+engines@*/node_modules/@prisma/engines/*engine*-linux-*; do \
         install -D "$engine" "/traced${engine#/app}"; \
       done \
    && for engine in /traced/node_modules/.pnpm/@prisma+engines@*/node_modules/@prisma/engines/libquery_engine-*; do \
         client="$(find /traced/node_modules/.pnpm -path '*/.prisma/client/*' -name "$(basename "$engine")" | head -n 1)"; \
         if [ -n "$client" ] && cmp -s "$engine" "$client"; then ln -f "$client" "$engine"; fi; \
       done

# Only the formats BLEX accepts are compiled, which also keeps untrusted uploads away from unused parsers.
FROM --platform=$BUILDPLATFORM alpine:3.24.3 AS ffmpeg-builder
ARG TARGETARCH
ARG FFMPEG_VERSION=8.1.3
ARG FFMPEG_SHA512=acc7dbacde58c91bbc4a86fa589d317515d40bc9bc1ca5f9c020034bb54bf3c8cd61ed70ce437b962bd50332ea8378b3ad52da1942cfdb29e380c33a90d2f0c1
RUN case "$TARGETARCH" in \
      amd64) arch=x86_64 ;; \
      arm64) arch=aarch64 ;; \
      *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && apk add --no-cache clang gcc lld llvm make musl-dev nasm pkgconf xz \
    && install -d /sysroot/etc/apk/keys \
    && cp /etc/apk/repositories /sysroot/etc/apk/repositories \
    && cp /usr/share/apk/keys/"$arch"/* /sysroot/etc/apk/keys/ \
    && apk add --no-cache --root /sysroot --arch "$arch" --initdb --no-scripts dav1d-dev gcc musl-dev x264-dev \
    && wget -q "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" -O /tmp/ffmpeg.tar.xz \
    && echo "${FFMPEG_SHA512}  /tmp/ffmpeg.tar.xz" | sha512sum -c - \
    && mkdir /tmp/ffmpeg && tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1 \
    && cd /tmp/ffmpeg \
    && target="--target=${arch}-alpine-linux-musl --sysroot=/sysroot" \
    && PKG_CONFIG_LIBDIR=/sysroot/usr/lib/pkgconfig PKG_CONFIG_SYSROOT_DIR=/sysroot ./configure \
       --prefix=/opt/ffmpeg --enable-cross-compile --arch="$arch" --target-os=linux \
       --cc="clang $target" --ld="clang $target -fuse-ld=lld" --host-cc=gcc \
       --ar=llvm-ar --nm=llvm-nm --ranlib=llvm-ranlib --strip=llvm-strip --pkg-config=pkg-config \
       --disable-everything --disable-autodetect --disable-doc --disable-debug \
       --disable-ffplay --disable-ffprobe --disable-network --disable-avdevice --disable-swresample \
       --enable-gpl --enable-libx264 --enable-libdav1d \
       --enable-protocol=file,pipe \
       --enable-demuxer=gif,matroska,mov \
       --enable-muxer=image2,mp4 \
       --enable-decoder=gif,h264,hevc,libdav1d,mjpeg,mpeg4,vp8,vp9 \
       --enable-encoder=libx264,mjpeg \
       --enable-parser=av1,gif,h264,hevc,mjpeg,mpeg4video,vp8,vp9 \
       --enable-filter=crop,format,hflip,null,scale,transpose,vflip \
    && make -j"$(nproc)" ffmpeg && llvm-strip ffmpeg && install -D ffmpeg /opt/ffmpeg/ffmpeg

# The final image starts from Alpine so the npm, Yarn, and Corepack layers of the Node image are not shipped.
FROM alpine:3.24.3 AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8040 \
    BLEX_V4_DB_PATH=/var/lib/blex/db.sqlite3 BLEX_V4_MEDIA_PATH=/var/lib/blex/media
RUN apk upgrade --no-cache \
    && apk add --no-cache libdav1d libgcc libssl3 libstdc++ x264-libs \
    && addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node \
    && install -d -o node -g node /var/lib/blex /var/lib/blex/media
COPY --from=node-binary /usr/local/bin/node /usr/local/bin/node
COPY --from=ffmpeg-builder /opt/ffmpeg/ffmpeg /usr/local/bin/ffmpeg
WORKDIR /app/packages/server
COPY packages/server/package.json ./
COPY packages/server/prisma ./prisma
COPY --from=traced-files /traced/node_modules /app/node_modules
COPY --from=traced-files /traced/packages/server/node_modules ./node_modules
COPY --from=build /app/packages/server/dist/src ./dist/src
COPY --from=build /app/packages/server/dist/client ./dist/client
COPY --from=web-builder /app/packages/server/dist/web ./dist/web
COPY packages/server/data ./data
COPY packages/server/public ./public
EXPOSE 8040
USER node
CMD ["node", "dist/src/main.js"]

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
RUN pnpm exec turbo run build --filter=@blex/web && find /app/packages/server/dist/islands -name '*.map' -delete

FROM node:24.22.1-alpine AS node-base
WORKDIR /app

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
RUN pnpm --filter @blex/server run build

FROM build AS migration
WORKDIR /app/packages/server
RUN install -d -o node -g node /var/lib/blex /var/lib/blex/media \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/pnpm /usr/local/lib/node_modules/corepack \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/corepack /opt/yarn-*
ENV DATABASE_URL=file:/var/lib/blex/db.sqlite3
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM build AS runtime-dependencies
RUN CI=true pnpm i --prod --frozen-lockfile --ignore-scripts --filter @blex/server \
    && rm -rf node_modules/.pnpm/@tabler+icons@* node_modules/.pnpm/@tabler+icons-react@*/node_modules/@tabler/icons-react/dist/cjs

FROM node-base AS runtime
WORKDIR /app/packages/server
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8040 \
    BLEX_V4_DB_PATH=/var/lib/blex/db.sqlite3 BLEX_V4_MEDIA_PATH=/var/lib/blex/media
RUN apk add --no-cache ffmpeg
COPY packages/server/package.json ./
COPY --from=runtime-dependencies /app/node_modules /app/node_modules
COPY --from=runtime-dependencies /app/packages/server/node_modules ./node_modules
COPY --from=build /app/packages/server/dist/src ./dist/src
COPY --from=build /app/packages/server/dist/client ./dist/client
COPY --from=web-builder /app/packages/server/dist/islands ./dist/islands
COPY packages/server/data ./data
COPY packages/server/public ./public
RUN install -d -o node -g node /var/lib/blex /var/lib/blex/media \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-*
EXPOSE 8040
USER node
CMD ["node", "dist/src/main.js"]

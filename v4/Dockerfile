FROM node:24.22.1-alpine AS node-base
WORKDIR /app

FROM node-base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

FROM build AS migration
RUN install -d -o node -g node /var/lib/blex /var/lib/blex/media
ENV DATABASE_URL=file:/var/lib/blex/db.sqlite3
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM build AS runtime-dependencies
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node-base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8040 \
    BLEX_V4_DB_PATH=/var/lib/blex/db.sqlite3 BLEX_V4_MEDIA_PATH=/var/lib/blex/media
RUN apk add --no-cache ffmpeg
COPY package.json ./
COPY --from=runtime-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist/src ./dist/src
COPY --from=build /app/dist/client ./dist/client
COPY data ./data
COPY public ./public
RUN install -d -o node -g node /var/lib/blex /var/lib/blex/media
EXPOSE 8040
USER node
CMD ["node", "dist/src/main.js"]

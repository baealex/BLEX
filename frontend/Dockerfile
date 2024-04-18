FROM node:21-alpine

WORKDIR /app

COPY ./src/package.json ./
COPY ./src/pnpm-lock.yaml ./

RUN npx pnpm i

COPY ./src/ ./

ENTRYPOINT ["npm", "run"]
CMD ["build-and-start"]

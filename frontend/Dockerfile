FROM node:20.11.1

WORKDIR /app

COPY ./src/package.json ./
COPY ./src/pnpm-lock.yaml ./

RUN npx pnpm i

COPY ./src/ ./

ENTRYPOINT ["npm", "run"]
CMD ["build-and-start"]

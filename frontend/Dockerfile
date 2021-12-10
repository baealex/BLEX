FROM node:16.13.1

WORKDIR /app

COPY ./src/package.json ./
COPY ./src/package-lock.json ./

RUN npm i

COPY ./src/ ./

RUN [ ! -f modules/settings.ts ] && cp modules/settings_1.ts modules/settings.ts ; exit 0

RUN npm run build

ENTRYPOINT ["npm", "run"]
CMD ["start"]
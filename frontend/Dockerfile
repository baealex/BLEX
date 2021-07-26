FROM node:14.16.0

COPY ./src/package.json /app/

WORKDIR /app

RUN npm i

COPY ./src/ /app/

RUN [ ! -f modules/settings.ts ] && cp modules/settings_1.ts modules/settings.ts ; exit 0

RUN npm run build

ENTRYPOINT ["npm", "run"]
CMD ["start"]
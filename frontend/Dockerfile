FROM node:12.18.3

COPY ./src/package.json /app/

WORKDIR /app
RUN npm i

COPY ./src/ /app/

RUN [ ! -f modules/config.json ] && cp modules/config_1.json modules/config.json ; exit 0

RUN npm run build

ENTRYPOINT ["npm", "run"]
CMD ["start"]
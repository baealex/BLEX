FROM node:12.18.3

COPY ./src/package.json /app/

WORKDIR /app
RUN npm i

COPY ./src/ /app/

RUN npm run build

ENTRYPOINT ["npm", "run"]
CMD ["start"]
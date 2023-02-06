FROM node:18.9.0

WORKDIR /app

COPY ./src/package.json ./
COPY ./src/package-lock.json ./

RUN npm i

COPY ./src/ ./

ENTRYPOINT ["npm", "run"]
CMD ["build-and-start"]

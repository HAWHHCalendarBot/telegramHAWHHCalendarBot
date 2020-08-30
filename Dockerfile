FROM node:14-alpine
WORKDIR /app
VOLUME /app/eventfiles
VOLUME /app/mensa-data
VOLUME /app/tmp
VOLUME /app/userconfig

RUN apk --no-cache add git

ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci

COPY source ./
CMD node index.js
